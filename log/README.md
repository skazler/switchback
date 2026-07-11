# log/

Runtime data lands here (and eventually in D1 — see repo README).

- `volume-history.csv` — raw export of the AAR weekly volume tracker
  (weeks 3/24/2025 – 12/14/2025). Rows = muscle groups / modalities,
  columns = weeks, values = weekly sets (or sessions for conditioning
  rows). The TRUE/FALSE region partway across is an overlapping p/rehab
  checkbox grid from the original sheet — needs a cleanup pass before
  querying.

- `history/` — historical training records extracted from `sources/Log.xlsx`
  by `scripts/import-log-history.mjs`:
  - `hypertrophy-strength.csv` (2020→) and `athleticism-conditioning.csv`
    (2025→) — tidy rows `date,category,exercise,exercise_id,measure,record,
    feel,notes`. `measure` = load (e.g. `20lbs`), `record` = sets×reps
    (e.g. `8x3`). `exercise_id` resolves to `exercises.yaml` where the name
    matches (~30%); the rest keep a slug + the raw cell in the set's notes.
  - `seed.sql` — the same data as D1 `sessions` + `sets` inserts
    (`program_id = 'history:<sheet>'`). NOTE: historical cells are per-
    exercise *summaries*, not per-set logs — the seed keeps one `sets` row
    per entry with the raw `measure/record` in `notes` and best-effort
    `reps`/`weight`. Apply once D1 exists:
    `wrangler d1 execute switchback --file log/history/seed.sql`.
  - `snowboard-sessions.csv` (`date,board,location,focus,conditions`) and
    `snowboard-tricks.csv` (`date,trick,landed,confidence,notes`) — from the
    `snowboard` sheet's session-overview + trick blocks. In `seed.sql` these
    are `sessions` (`program_id='history:snowboard'`) with each trick a `sets`
    row (`exercise_id` = trick slug; landed/confidence/notes in `notes`). The
    top COUNTERS summary is logged to console, not stored.

- `adv-log.csv` / `adv-log-seed.sql` — completed days of the CURRENT block,
  lifted from `sources/Adv Log.xlsx` by `scripts/import-adv-log.mjs`. D1
  `sessions` with `program_id = '2026-race-prep'`; the free-text `Actual` +
  life notes go in `session.notes` (no set-level parsing — future sessions log
  structured via the app). Apply:
  `wrangler d1 execute switchback --file log/adv-log-seed.sql`.

Source spreadsheets live in `sources/` (git-tracked so imports re-run).

Once the logging client exists, the D1 schema replaces manual tracking:

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,            -- ISO date
  program_id TEXT,               -- FK -> programs/<id>.md
  day TEXT,                      -- e.g. 'T lower strength'
  notes TEXT
);
CREATE TABLE sets (
  id INTEGER PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id),
  exercise_id TEXT NOT NULL,     -- FK -> exercises.yaml id
  set_num INTEGER,
  reps INTEGER, weight REAL, rpe REAL,
  duration_s INTEGER             -- for holds / carries / cardio
);
```

The old AAR grid then becomes a query:
`SELECT strftime('%Y-%W', date), SUM(...) GROUP BY week, muscle_group`.
