import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';

const CSRF_EXCLUDED_PATHS: { path: string; method: string }[] = [
  { path: '/auth/login', method: 'POST' },
  { path: '/auth/register', method: 'POST' },
  { path: '/auth/refresh', method: 'POST' },
  { path: '/auth/logout', method: 'POST' },
  { path: '/auth/send-otp', method: 'POST' },
  { path: '/auth/verify-otp', method: 'POST' },
  { path: '/auth/dev-reset-seed-users', method: 'POST' },
  { path: '/users/me', method: 'PATCH' },
  { path: '/payments/click/callback', method: 'POST' },
  { path: '/payments/payme/callback', method: 'POST' },
  { path: '/cart', method: 'GET' },
  { path: '/cart/items', method: 'POST' },
  { path: '/orders', method: 'POST' },
  /** Multipart + JWT Bearer; proksi/mobil cookie muammolaridan qochish */
  { path: '/upload/image', method: 'POST' },
];

function isCartItemRoute(path: string, method: string): boolean {
  return /^\/cart\/items\/[^/]+$/.test(path) && (method === 'PATCH' || method === 'DELETE');
}

function isExcluded(path: string, method: string): boolean {
  if (CSRF_EXCLUDED_PATHS.some((e) => e.path === path && e.method === method)) return true;
  if (isCartItemRoute(path, method)) return true;
  return false;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();
    const path = req.path;
    // GET /auth/csrf обрабатывается роутом AuthController.getCsrf()

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (isExcluded(path, method)) return next();
      const headerToken = req.headers[CSRF_HEADER] as string;
      const cookieToken = req.cookies?.[CSRF_COOKIE];
      if (!headerToken || headerToken !== cookieToken) {
        return res.status(403).json({ message: 'Invalid CSRF token' });
      }
    }
    next();
  }
}
