import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userId = user?.id ? String(user.id) : null;
    const role = user?.role ? String(user.role) : null;
    const sessionId = request.cookies?.cartSessionId ?? request.headers['x-cart-session'] ?? null;
    return from(this.prisma.setRlsContext(userId, role, sessionId ?? undefined)).pipe(
      switchMap(() => next.handle())
    );
  }
}
