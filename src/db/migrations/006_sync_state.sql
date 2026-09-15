CREATE TABLE IF NOT EXISTS sync_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_reconciled_day date,
  last_maintenance_at timestamptz
);
INSERT INTO sync_state(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY,
  trigger text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  summary jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS sync_runs_started_idx ON sync_runs(started_at DESC);
CREATE TABLE IF NOT EXISTS storage_observations (
  day date PRIMARY KEY,
  observed_at timestamptz NOT NULL DEFAULT now(),
  database_bytes bigint NOT NULL,
  raw_bytes bigint NOT NULL
);
