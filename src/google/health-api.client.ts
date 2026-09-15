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

// Conservative local pacing, not a statement of the project's assigned quota.
const MIN_REQUEST_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_BUDGET_MS = 90_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

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
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestStarted = -Infinity;

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
      if (page.status < 200 || page.status >= 300) return { pages, items: [], ok: false };
      const body = page.body as { dataPoints?: unknown[]; nextPageToken?: string };
      items.push(...(body.dataPoints ?? []));
      pageToken = body.nextPageToken || undefined;
      if (!pageToken) break;
    }
    if (pageToken) {
      pages[pages.length - 1].errorText = `pagination limit reached (${maxPages} pages); more data remains`;
      return { pages, items: [], ok: false };
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
    if (page.status < 200 || page.status >= 300) return { pages: [page], items: [], ok: false };
    const items = ((page.body as { rollupDataPoints?: unknown[] }).rollupDataPoints) ?? [];
    return { pages: [page], items, ok: true };
  }

  async listPairedDevices(): Promise<RawPage> {
    return this.request('GET', `${HEALTH_API_BASE}/users/me/pairedDevices`, undefined, 0);
  }

  private async request(method: 'GET' | 'POST', url: string, body: unknown, pageIndex: number): Promise<RawPage> {
    const result = this.requestQueue.then(() => this.requestWithRetries(method, url, body, pageIndex));
    this.requestQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async requestWithRetries(method: 'GET' | 'POST', url: string, body: unknown, pageIndex: number): Promise<RawPage> {
    const started = Date.now();
    let retryDelay = 0;
    let lastPage: RawPage | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const waitMs = Math.max(retryDelay, this.lastRequestStarted + MIN_REQUEST_INTERVAL_MS - Date.now(), 0);
      // Never shorten a server Retry-After to fit our budget.
      if (lastPage && Date.now() - started + waitMs >= RETRY_BUDGET_MS) return lastPage;
      if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
      const token = await this.oauth.getAccessToken();
      const remainingMs = RETRY_BUDGET_MS - (Date.now() - started);
      if (lastPage && remainingMs <= 0) return lastPage;
      this.lastRequestStarted = Date.now();
      let retryable = false;
      let retryAfterMs = 0;
      try {
        const res = await fetch(url, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/json',
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, remainingMs))),
        });
        retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
        const text = await res.text();
        let parsed: unknown;
        try { parsed = text ? JSON.parse(text) : null; }
        catch { parsed = { text: text.slice(0, 5000) }; }
        lastPage = { pageIndex, url, requestBody: body, status: res.status,
          durationMs: Date.now() - started, body: parsed,
          ...(!res.ok ? { errorText: text.slice(0, 1000) } : {}) };
        if (res.ok) return lastPage;
        retryable = RETRYABLE_STATUSES.has(res.status);
        this.log.warn(`${method} ${url.split('?')[0]} -> ${res.status} (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
      } catch (e) {
        const error = e as Error;
        lastPage = { pageIndex, url, requestBody: body, status: 0,
          durationMs: Date.now() - started, body: null, errorText: `network: ${error.message}` };
        retryable = error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name);
        this.log.warn(`${method} ${url.split('?')[0]} -> network failure (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
      }
      // Persist only the final attempt per logical page; failed attempts are logged.
      if (!retryable || attempt === MAX_ATTEMPTS - 1) return lastPage;
      retryDelay = Math.max(retryAfterMs, 1000 * 2 ** attempt + Math.floor(Math.random() * 250));
    }
    return lastPage!;
  }
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 0;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

/** "2026-09-09" -> CivilDateTime { date: {year, month, day}, time: {hours:0,…} } (per REST reference). */
export function civilDateTime(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { date: { year: y, month: m, day: d }, time: { hours: 0, minutes: 0, seconds: 0 } };
}
