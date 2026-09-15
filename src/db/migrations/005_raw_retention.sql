-- No hash backfill: old provenance IDs remain untouched and legacy rows can
-- expire only after they are no longer referenced. Nullable additions avoid a
-- payload scan/rewrite of the existing raw history.
ALTER TABLE api_responses ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE api_responses ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;
ALTER TABLE api_responses ADD COLUMN IF NOT EXISTS seen_count BIGINT NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS api_responses_payload_hash_uidx
  ON api_responses (payload_hash) WHERE payload_hash IS NOT NULL;
