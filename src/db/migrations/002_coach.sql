-- Chat with the AI coach. Every assistant reply records the model, prompt version and the
-- exact computed context it was given, so any statement can be traced back to inputs.
CREATE TABLE IF NOT EXISTS coach_messages (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  lang             TEXT,
  model            TEXT,
  prompt_version   TEXT,
  context_snapshot JSONB,
  usage            JSONB,
  error            TEXT
);
CREATE INDEX IF NOT EXISTS coach_messages_created_idx ON coach_messages (created_at DESC);
