-- Layer 0: OAuth credentials (encrypted at rest, never returned by the API)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider            TEXT PRIMARY KEY,           -- 'google'
  refresh_token_enc   TEXT NOT NULL,              -- AES-256-GCM, base64
  access_token_enc    TEXT,
  access_token_expiry TIMESTAMPTZ,
  scopes              TEXT[] NOT NULL DEFAULT '{}',
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refresh_at     TIMESTAMPTZ,
  last_error          TEXT,
  last_error_at       TIMESTAMPTZ
);

-- Layer 1: upstream API responses, kept verbatim (minus auth headers) for inspection
CREATE TABLE IF NOT EXISTS api_responses (
  id             BIGSERIAL PRIMARY KEY,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider       TEXT NOT NULL,                   -- 'google-health'
  data_type      TEXT NOT NULL,                   -- e.g. 'sleep', 'daily-heart-rate-variability'
  method         TEXT NOT NULL,                   -- 'list' | 'reconcile' | 'dailyRollUp'
  request_url    TEXT NOT NULL,                   -- full URL incl. query (no tokens)
  request_body   JSONB,                           -- for POST methods
  range_start    TIMESTAMPTZ,                     -- requested window (physical time)
  range_end      TIMESTAMPTZ,
  http_status    INT NOT NULL,
  duration_ms    INT,
  page_index     INT NOT NULL DEFAULT 0,
  payload        JSONB,                           -- response body as returned
  error_text     TEXT,
  batch_id       UUID NOT NULL                    -- groups all pages/types of one refresh action
);
CREATE INDEX IF NOT EXISTS api_responses_type_time_idx ON api_responses (data_type, fetched_at DESC);
CREATE INDEX IF NOT EXISTS api_responses_batch_idx ON api_responses (batch_id);

-- Layer 2a: normalized per-day metrics. One row per (day, metric). Re-fetching upserts, never duplicates.
CREATE TABLE IF NOT EXISTS daily_metrics (
  day               DATE NOT NULL,                -- civil date in USER_TIMEZONE the value is attributed to
  metric            TEXT NOT NULL,                -- see src/ingest/metrics.ts
  value             DOUBLE PRECISION,             -- NULL = missing (distinct from 0)
  unit              TEXT NOT NULL,
  status            TEXT NOT NULL,                -- 'ok' | 'missing' | 'partial'
  status_reason     TEXT,
  source_response_ids BIGINT[] NOT NULL DEFAULT '{}',
  source_point_name TEXT,                         -- DataPoint.name when the API provides one
  measured_start    TIMESTAMPTZ,                  -- actual measurement window (NOT fetch time)
  measured_end      TIMESTAMPTZ,
  details           JSONB,                        -- metric-specific extras (e.g. sleep stages summary)
  normalizer_version TEXT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, metric)
);

-- Layer 2b: computed results (baseline/deviations) — filled in the calculation phase
CREATE TABLE IF NOT EXISTS computed_results (
  id                BIGSERIAL PRIMARY KEY,
  day               DATE NOT NULL,
  algorithm_version TEXT NOT NULL,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_days        DATE[] NOT NULL,
  result            JSONB NOT NULL,               -- baselines, deviations, data-quality flags, reasons
  UNIQUE (day, algorithm_version)
);

-- Layer 3: coaching reports — filled in the GLM phase
CREATE TABLE IF NOT EXISTS coaching_reports (
  id                 BIGSERIAL PRIMARY KEY,
  day                DATE NOT NULL,
  computed_result_id BIGINT REFERENCES computed_results(id),
  prompt_version     TEXT NOT NULL,
  model              TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  output             JSONB NOT NULL,
  validation_status  TEXT NOT NULL,               -- 'valid' | 'fallback' | 'invalid'
  delivery_state     TEXT NOT NULL DEFAULT 'pending',
  delivered_at       TIMESTAMPTZ
);

-- Self check-ins (fatigue, soreness, illness, planned activity) — filled later
CREATE TABLE IF NOT EXISTS checkins (
  id         BIGSERIAL PRIMARY KEY,
  day        DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload    JSONB NOT NULL
);
