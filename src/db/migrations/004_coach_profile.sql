-- Coach personalisation (single user). Free text is shown to the language model verbatim, so keep it the user's own words.
CREATE TABLE IF NOT EXISTS coach_profile (
  id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tone                text NOT NULL DEFAULT 'balanced' CHECK (tone IN ('relaxed', 'balanced', 'strict')),
  verbosity           text NOT NULL DEFAULT 'normal'   CHECK (verbosity IN ('brief', 'normal')),
  occupation          text,
  lifestyle           text,
  health_notes        text,
  exercise_purpose    text,
  custom_instructions text,
  chat_notes          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "at": iso, "text": "..." }] added from chat with "จำไว้ว่า …" / "/remember …"
  goal_sleep_min      integer CHECK (goal_sleep_min IS NULL OR goal_sleep_min BETWEEN 180 AND 720),
  goal_steps          integer CHECK (goal_steps IS NULL OR goal_steps BETWEEN 1000 AND 50000),
  goal_azm_week       integer CHECK (goal_azm_week IS NULL OR goal_azm_week BETWEEN 30 AND 2000),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
INSERT INTO coach_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
