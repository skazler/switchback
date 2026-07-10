-- Switchback D1 schema (FLOWS §11). Runtime data only; authored content
-- stays in the repo. Apply with:
--   wrangler d1 migrations apply switchback           (remote)
--   wrangler d1 migrations apply switchback --local   (local dev)

CREATE TABLE IF NOT EXISTS credentials (
  id          TEXT PRIMARY KEY,           -- WebAuthn credential id (base64url)
  public_key  TEXT NOT NULL,              -- COSE public key (base64url)
  counter     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,          -- client ULID
  date         TEXT NOT NULL,             -- ISO date
  program_id   TEXT,
  day          TEXT,                      -- day slug / label
  started_at   TEXT,
  completed_at TEXT,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS sets (
  id                 TEXT PRIMARY KEY,     -- client ULID
  session_id         TEXT NOT NULL REFERENCES sessions(id),
  exercise_id        TEXT NOT NULL,        -- exercises.yaml id (planned)
  performed_instead  TEXT,                 -- exercises.yaml id (actual, if swapped)
  set_num            INTEGER,
  reps               INTEGER,
  weight             REAL,
  unit               TEXT DEFAULT 'lb',
  rpe                REAL,
  duration_s         INTEGER,
  notes              TEXT,
  logged_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS volume_baseline (  -- one-off import of AAR history
  week          TEXT NOT NULL,
  muscle_group  TEXT NOT NULL,
  sets          REAL
);

CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id, weight);
CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
