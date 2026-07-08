# log/

Runtime data lands here (and eventually in D1 — see repo README).

- `volume-history.csv` — raw export of the AAR weekly volume tracker
  (weeks 3/24/2025 – 12/14/2025). Rows = muscle groups / modalities,
  columns = weeks, values = weekly sets (or sessions for conditioning
  rows). The TRUE/FALSE region partway across is an overlapping p/rehab
  checkbox grid from the original sheet — needs a cleanup pass before
  querying.

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
