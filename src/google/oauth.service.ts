import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { decrypt, encrypt } from './crypto';

/**
 * Read-only scopes needed for the first milestone (sleep, HRV, RHR, activity).
 * Source: https://developers.google.com/health/scopes
 */
export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
];

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface ConnectionStatus {
  connected: boolean;
  scopes: string[];
  connectedAt?: string;
  lastRefreshAt?: string;
  accessTokenExpiry?: string;
  lastError?: string;
  lastErrorAt?: string;
  /** true when the refresh token was rejected and the user must reconnect */
  needsReconnect: boolean;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly log = new Logger(GoogleOAuthService.name);
  // single-user app: one pending state at a time is enough
  private pendingStates = new Map<string, number>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Build the consent URL. `access_type=offline` + `prompt=consent` is required to receive a refresh token. */
  buildAuthUrl(): string {
    this.assertConfigured();
    const state = randomBytes(16).toString('hex');
    this.pendingStates.set(state, Date.now());
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: config.googleRedirectUri,
      response_type: 'code',
      scope: HEALTH_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /** Exchange the authorization code and persist the (encrypted) refresh token. */
  async handleCallback(code: string, state?: string): Promise<ConnectionStatus> {
    this.assertConfigured();
    if (state !== undefined) {
      const issued = this.pendingStates.get(state);
      this.pendingStates.delete(state);
      if (!issued || Date.now() - issued > 15 * 60_000) {
        throw new Error('OAuth state is unknown or expired; start the flow again');
      }
    }
    const body = new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
    });
    const tok = await this.postToken(body);
    if (!tok.refresh_token) {
      throw new Error('Google did not return a refresh_token. Revoke the app at myaccount.google.com/permissions and retry.');
    }
    const expiry = new Date(Date.now() + tok.expires_in * 1000);
    await this.pool.query(
      `INSERT INTO oauth_tokens (provider, refresh_token_enc, access_token_enc, access_token_expiry, scopes, connected_at, last_refresh_at, last_error, last_error_at)
       VALUES ('google', $1, $2, $3, $4, now(), now(), NULL, NULL)
       ON CONFLICT (provider) DO UPDATE SET
         refresh_token_enc = EXCLUDED.refresh_token_enc,
         access_token_enc = EXCLUDED.access_token_enc,
         access_token_expiry = EXCLUDED.access_token_expiry,
         scopes = EXCLUDED.scopes,
         connected_at = now(), last_refresh_at = now(), last_error = NULL, last_error_at = NULL`,
      [
        encrypt(tok.refresh_token, config.TOKEN_ENCRYPTION_KEY),
        encrypt(tok.access_token, config.TOKEN_ENCRYPTION_KEY),
        expiry,
        (tok.scope ?? '').split(' ').filter(Boolean),
      ],
    );
    this.log.log('Google account connected');
    return this.status();
  }

  /** Returns a valid access token, refreshing when it expires within 60 s. */
  async getAccessToken(): Promise<string> {
    const { rows } = await this.pool.query(
      `SELECT refresh_token_enc, access_token_enc, access_token_expiry FROM oauth_tokens WHERE provider = 'google'`,
    );
    const row = rows[0];
    if (!row) throw new NotConnectedError('Google account not connected. Open /auth/google/start');
    const key = config.TOKEN_ENCRYPTION_KEY;
    const expiry: Date | null = row.access_token_expiry;
    if (row.access_token_enc && expiry && expiry.getTime() - Date.now() > 60_000) {
      return decrypt(row.access_token_enc, key);
    }
    const body = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: decrypt(row.refresh_token_enc, key),
      grant_type: 'refresh_token',
    });
    try {
      const tok = await this.postToken(body);
      await this.pool.query(
        `UPDATE oauth_tokens SET access_token_enc = $1, access_token_expiry = $2, last_refresh_at = now(), last_error = NULL, last_error_at = NULL
         WHERE provider = 'google'`,
        [encrypt(tok.access_token, key), new Date(Date.now() + tok.expires_in * 1000)],
      );
      return tok.access_token;
    } catch (e) {
      const msg = (e as Error).message;
      await this.pool.query(
        `UPDATE oauth_tokens SET last_error = $1, last_error_at = now() WHERE provider = 'google'`,
        [msg.slice(0, 500)],
      );
      throw new NotConnectedError(`Token refresh failed: ${msg}. Reconnect at /auth/google/start`);
    }
  }

  async status(): Promise<ConnectionStatus> {
    const { rows } = await this.pool.query(
      `SELECT scopes, connected_at, last_refresh_at, access_token_expiry, last_error, last_error_at FROM oauth_tokens WHERE provider = 'google'`,
    );
    const r = rows[0];
    if (!r) return { connected: false, scopes: [], needsReconnect: true };
    const invalidGrant = typeof r.last_error === 'string' && /invalid_grant|invalid_client|unauthorized/i.test(r.last_error);
    return {
      connected: true,
      scopes: r.scopes,
      connectedAt: r.connected_at?.toISOString(),
      lastRefreshAt: r.last_refresh_at?.toISOString(),
      accessTokenExpiry: r.access_token_expiry?.toISOString(),
      lastError: r.last_error ?? undefined,
      lastErrorAt: r.last_error_at?.toISOString(),
      needsReconnect: invalidGrant,
    };
  }

  async disconnect(): Promise<void> {
    await this.pool.query(`DELETE FROM oauth_tokens WHERE provider = 'google'`);
  }

  private async postToken(body: URLSearchParams): Promise<TokenResponse> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      // Google returns {"error":"invalid_grant","error_description":"..."} — safe to log (no secrets).
      throw new Error(`token endpoint ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as TokenResponse;
  }

  private assertConfigured() {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set');
    }
    if (!config.TOKEN_ENCRYPTION_KEY) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  }
}

export class NotConnectedError extends Error {}
