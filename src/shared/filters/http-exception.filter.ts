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
import { getLogUserId, sanitizeLogUrl } from '../helpers';

type RequestLogSource = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: unknown;
};

type ResponseWithLocals = {
  locals: Record<string, unknown>;
  status: (status: number) => {
    json: (body: unknown) => unknown;
  };
};

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ResponseWithLocals>();
    const request = ctx.getRequest<RequestLogSource>();
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
      path: sanitizeLogUrl(request.originalUrl || request.url),
      message,
    };

    if (exception['response']) {
      result['body'] = exception['response'];
    }

    if (this.configService.get<string>(ENV.APP_ENV) === APP_ENV.DEV) {
      result['error'] = exception;
    }

    const trace = exception instanceof Error ? exception.stack : undefined;
    response.locals.exceptionLogged = true;
    this.logger.error(
      {
        message,
        request: this.getRequestLogMetadata(request, status),
        userId: getLogUserId(request.user),
        error: exception instanceof Error ? exception : undefined,
      },
      trace,
      LOGGER_CONTEXT.WEB,
    );

    response.status(status).json(result);
  }

  private getRequestLogMetadata(request: RequestLogSource, statusCode: number) {
    return {
      method: request.method,
      url: sanitizeLogUrl(request.originalUrl || request.url),
      statusCode,
      host: request.ip,
      origin: request.headers?.origin,
      userAgent: request.headers?.['user-agent'],
    };
  }
}
