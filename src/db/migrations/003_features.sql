-- Exercise sessions from Google Health (one row per session; upsert on start time + type)
CREATE TABLE IF NOT EXISTS exercise_sessions (
  id                BIGSERIAL PRIMARY KEY,
  point_name        TEXT,
  day               DATE NOT NULL,
  exercise_type     TEXT NOT NULL,
  display_name      TEXT,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ NOT NULL,
  active_min        INT,
  avg_hr            INT,
  calories_kcal     DOUBLE PRECISION,
  distance_m        DOUBLE PRECISION,
  steps             INT,
  azm               INT,
  zone_light_min    DOUBLE PRECISION, zone_moderate_min DOUBLE PRECISION, zone_vigorous_min DOUBLE PRECISION, zone_peak_min DOUBLE PRECISION,
  source_response_ids BIGINT[] NOT NULL DEFAULT '{}',
  raw               JSONB,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (started_at, exercise_type)
);
CREATE INDEX IF NOT EXISTS exercise_sessions_day_idx ON exercise_sessions (day);

-- Journal: one row per day, fixed tag vocabulary (see src/insights/tags.ts) + free note
CREATE TABLE IF NOT EXISTS journal_entries (
  day        DATE PRIMARY KEY,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  note       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strength log
CREATE TABLE IF NOT EXISTS strength_sessions (
  id           BIGSERIAL PRIMARY KEY,
  day          DATE NOT NULL,
  started_at   TIMESTAMPTZ,
  duration_min INT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS strength_sets (
  id          BIGSERIAL PRIMARY KEY,
  session_id  BIGINT NOT NULL REFERENCES strength_sessions(id) ON DELETE CASCADE,
  exercise    TEXT NOT NULL,
  muscle_group TEXT,
  set_no      INT NOT NULL,
  reps        INT NOT NULL,
  load_kg     DOUBLE PRECISION NOT NULL DEFAULT 0,
  rpe         DOUBLE PRECISION,
  rir         DOUBLE PRECISION,
  is_warmup   BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS strength_sets_session_idx ON strength_sets (session_id);

-- User profile (single row) — inputs some models need (age/sex for fitness age & HRmax)
CREATE TABLE IF NOT EXISTS user_profile (
  id           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  birth_year   INT,
  sex          TEXT CHECK (sex IN ('male','female')),
  height_cm    DOUBLE PRECISION,
  hr_max       INT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blood panels for PhenoAge (values stored in Levine 2018 units; UI converts)
CREATE TABLE IF NOT EXISTS blood_panels (
  id             BIGSERIAL PRIMARY KEY,
  drawn_on       DATE NOT NULL,
  albumin_g_l    DOUBLE PRECISION,
  creatinine_umol_l DOUBLE PRECISION,
  glucose_mmol_l DOUBLE PRECISION,
  crp_mg_dl      DOUBLE PRECISION,
  lymphocyte_pct DOUBLE PRECISION,
  mcv_fl         DOUBLE PRECISION,
  rdw_pct        DOUBLE PRECISION,
  alp_u_l        DOUBLE PRECISION,
  wbc_k_ul       DOUBLE PRECISION,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
