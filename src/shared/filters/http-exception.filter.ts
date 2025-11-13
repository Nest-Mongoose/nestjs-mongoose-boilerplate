import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Error as MongooseError } from 'mongoose';

import { APP_ENV, ENV, LOGGER_CONTEXT } from '../enums';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    let status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = exception instanceof Error ? exception.message : 'Internal Server Error';

    // Handle Mongoose validation errors
    if (exception instanceof MongooseError.ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = Object.values(exception.errors)
        .map((err) => err.message)
        .join(', ');
    }
    // Handle Mongoose duplicate key errors (MongoDB E11000)
    else if ((exception as any)?.code === 11000) {
      status = HttpStatus.CONFLICT;
      message = 'Unique constraint failed';
    }
    // Handle Mongoose cast errors (invalid ObjectId, etc.)
    else if (exception instanceof MongooseError.CastError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid ID format';
    }
    // Handle Mongoose document not found errors
    else if (exception instanceof MongooseError.DocumentNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Not Found';
    }

    const result = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    if (exception['response']) {
      result['body'] = exception['response'];
    }

    if (this.configService.get<string>(ENV.APP_ENV) === APP_ENV.DEV) {
      result['error'] = exception;
    }

    this.logger.error(exception, '', LOGGER_CONTEXT.WEB);

    response.status(status).json(result);
  }
}
