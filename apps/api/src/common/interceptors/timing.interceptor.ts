import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response, Request } from 'express';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP_TIMING');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const start = process.hrtime();

    return next.handle().pipe(
      tap(() => {
        const [seconds, nanoseconds] = process.hrtime(start);
        const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);

        // Add standard Server-Timing HTTP header
        if (res && typeof res.setHeader === 'function' && !res.headersSent) {
          res.setHeader('Server-Timing', `total;dur=${durationMs};desc="Total Processing"`);
        }

        // Safe development duration logging (only logs method, path, status, and duration)
        if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_TIMING_LOGS === 'true') {
          const status = res?.statusCode || 200;
          this.logger.debug(`[HTTP] ${req.method} ${req.url} ${status} - ${durationMs}ms`);
        }
      }),
    );
  }
}
