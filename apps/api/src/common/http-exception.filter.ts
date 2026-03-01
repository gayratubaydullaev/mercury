import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let body: Record<string, unknown> = {
      statusCode: status,
      message,
      error: 'Internal Server Error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      message = typeof payload === 'object' && payload !== null && 'message' in payload
        ? (payload as { message: string | string[] }).message
        : String(payload);
      body = {
        statusCode: status,
        message,
        error: exception.name,
      };
    } else if (exception instanceof Error) {
      this.logger.error(
        `${req.method} ${req.url} ${exception.message}`,
        exception.stack,
      );
      if (!isProd) {
        body.message = exception.message;
        body.stack = exception.stack;
      }
    }

    res.status(status).json(body);
  }
}
