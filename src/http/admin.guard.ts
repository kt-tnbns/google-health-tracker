import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { config } from '../config';

/**
 * Single-user protection: `x-admin-token` header or `?token=` query must equal ADMIN_TOKEN.
 *
 * Brute-force throttle (in-memory, per client IP): after MAX_FAILS wrong tokens within WINDOW_MS the IP
 * gets 429 for LOCK_MS. Correct tokens are never throttled. Client IP is taken from X-Forwarded-For
 * (Traefik/Dokploy sit in front of the app) falling back to the socket address.
 */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

interface Bucket { fails: number[]; lockedUntil: number }
const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

/** Exposed for tests. */
export function checkAndRecord(ip: string, ok: boolean, now = Date.now()): 'ok' | 'unauthorized' | 'locked' {
  const b = buckets.get(ip) ?? { fails: [], lockedUntil: 0 };
  if (b.lockedUntil > now) return 'locked';
  if (ok) { buckets.delete(ip); return 'ok'; }
  b.fails = b.fails.filter((t) => now - t < WINDOW_MS);
  b.fails.push(now);
  if (b.fails.length >= MAX_FAILS) { b.lockedUntil = now + LOCK_MS; b.fails = []; }
  buckets.set(ip, b);
  if (buckets.size > 10_000) buckets.clear();            // memory guard against IP spraying
  return b.lockedUntil > now ? 'locked' : 'unauthorized';
}
export function resetThrottle() { buckets.clear(); }

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly log = new Logger(AdminGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = clientIp(req);
    const supplied = (req.headers['x-admin-token'] as string | undefined) ?? (req.query.token as string | undefined) ?? '';
    const a = Buffer.from(supplied), b = Buffer.from(config.ADMIN_TOKEN);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    const verdict = checkAndRecord(ip, ok);
    if (verdict === 'locked') {
      this.log.warn(`admin token: too many failures from ${ip} — locked`);
      throw new HttpException('Too many attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (verdict === 'unauthorized') { this.log.warn(`admin token: wrong token from ${ip}`); throw new UnauthorizedException(); }
    return true;
  }
}
