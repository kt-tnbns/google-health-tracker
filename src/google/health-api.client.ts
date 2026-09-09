import { Injectable, Logger } from '@nestjs/common';
import { GoogleOAuthService } from './oauth.service';

/**
 * Thin client for Google Health API v4.
 * Reference: https://developers.google.com/health/reference/rest
 *
 *   GET  https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints
 *   GET  https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints:reconcile
 *   POST https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints:dailyRollUp
 *
 * Filter syntax (AIP-160): `{dataType}.interval.start_time >= "2026-09-01T00:00:00Z" AND ...`
 * The exact filter field per data type is declared in src/ingest/metrics.ts.
 */
export const HEALTH_API_BASE = 'https://health.googleapis.com/v4';

export interface RawPage {
  pageIndex: number;
  url: string;
  requestBody?: unknown;
  status: number;
  durationMs: number;
  body: unknown;      // parsed JSON (or { text } when not JSON)
  errorText?: string;
}

export interface FetchResult {
  pages: RawPage[];
  /** concatenated dataPoints / rollupDataPoints across pages; empty on error */
  items: unknown[];
  ok: boolean;
}

export type ReadMethod = 'list' | 'reconcile';

@Injectable()
export class HealthApiClient {
  private readonly log = new Logger(HealthApiClient.name);

  constructor(private readonly oauth: GoogleOAuthService) {}

  /** list / reconcile with automatic pagination (bounded). */
  async read(dataType: string, method: ReadMethod, filter: string, opts: { pageSize?: number; maxPages?: number } = {}): Promise<FetchResult> {
    const pages: RawPage[] = [];
    const items: unknown[] = [];
    const maxPages = opts.maxPages ?? 10;
    let pageToken: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const params = new URLSearchParams({ filter });
      if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
      if (pageToken) params.set('pageToken', pageToken);
      const suffix = method === 'reconcile' ? '/dataPoints:reconcile' : '/dataPoints';
      const url = `${HEALTH_API_BASE}/users/me/dataTypes/${dataType}${suffix}?${params.toString()}`;
      const page = await this.request('GET', url, undefined, i);
      pages.push(page);
      if (page.status >= 400) return { pages, items: [], ok: false };
      const body = page.body as { dataPoints?: unknown[]; nextPageToken?: string };
      items.push(...(body.dataPoints ?? []));
      pageToken = body.nextPageToken || undefined;
      if (!pageToken) break;
    }
    return { pages, items, ok: true };
  }

  /** dailyRollUp over a civil-date range [start, end). */
  async dailyRollUp(dataType: string, startDate: string, endDate: string): Promise<FetchResult> {
    const url = `${HEALTH_API_BASE}/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`;
    const body = {
      range: { start: civilDateTime(startDate), end: civilDateTime(endDate) },
      windowSizeDays: 1,
    };
    const page = await this.request('POST', url, body, 0);
    if (page.status >= 400) return { pages: [page], items: [], ok: false };
    const items = ((page.body as { rollupDataPoints?: unknown[] }).rollupDataPoints) ?? [];
    return { pages: [page], items, ok: true };
  }

  async listPairedDevices(): Promise<RawPage> {
    return this.request('GET', `${HEALTH_API_BASE}/users/me/pairedDevices`, undefined, 0);
  }

  private async request(method: 'GET' | 'POST', url: string, body: unknown, pageIndex: number): Promise<RawPage> {
    const token = await this.oauth.getAccessToken();
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return { pageIndex, url, requestBody: body, status: 0, durationMs: Date.now() - started, body: null, errorText: `network: ${(e as Error).message}` };
    }
    const durationMs = Date.now() - started;
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { text: text.slice(0, 5000) };
    }
    if (!res.ok) {
      this.log.warn(`${method} ${url.split('?')[0]} -> ${res.status}`);
      return { pageIndex, url, requestBody: body, status: res.status, durationMs, body: parsed, errorText: text.slice(0, 1000) };
    }
    return { pageIndex, url, requestBody: body, status: res.status, durationMs, body: parsed };
  }
}

/** "2026-09-09" -> CivilDateTime {year, month, day, hours:0, ...} */
export function civilDateTime(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { year: y, month: m, day: d, hours: 0, minutes: 0, seconds: 0 };
}
