import { type Configuration } from '@/config/configuration.js';
import { LOGGER_CONTEXT } from '@/logging/logger.constants.js';
import { getLogUserId, sanitizeLogUrl } from '@/logging/request-log-context.js';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';

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

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  body?: unknown;
  error?: unknown;
}

type MongoDuplicateKeyError = {
  code: number;
  keyPattern?: Record<string, unknown>;
};

function isMongoDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return (
    candidate.code === 11000 &&
    (candidate.keyPattern === undefined ||
      (typeof candidate.keyPattern === 'object' && candidate.keyPattern !== null))
  );
}

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly config: Configuration['app'],
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
    else if (isMongoDuplicateKeyError(exception)) {
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

    const result: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: sanitizeLogUrl(request.originalUrl || request.url) || '',
      message,
    };

    if (exception instanceof HttpException) {
      result.body = exception.getResponse();
    }

    if (this.config.isDevelopment) {
      result.error = exception;
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
