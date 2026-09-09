import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { config } from '../config';

/** Single-user protection: `x-admin-token` header or `?token=` query must equal ADMIN_TOKEN. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const supplied = (req.headers['x-admin-token'] as string | undefined) ?? (req.query.token as string | undefined) ?? '';
    const expected = config.ADMIN_TOKEN;
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
