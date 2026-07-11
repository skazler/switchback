# sources/

Raw originals that authored content + log imports are generated from.
Git-tracked so imports stay reproducible (the earlier `drive-download-*`
originals were lost and `scripts/import-xlsx.mjs` can no longer re-run).

- `Adv Log.xlsx` — the current training block as a dated calendar
  (29JUN2026 → race, 14NOV2026 at Reveille Peak Ranch). `Plan` column →
  authored into `programs/2026-race-prep.md`; `Actual`/`Notes` → the log
  (D1 `sessions`).
- `baseline.numbers` — the A/B lift templates the Adv Log lift days link to
  (Upper A / Lower A / Upper B / Lower B). Plugged into
  `programs/2026-race-prep.md` as its rotation day-sections. (Apple Numbers;
  read with the `numbers-parser` Python package.)
- `Log.xlsx` — historical hand-kept records (2020→). Extracted by
  `scripts/import-log-history.mjs` → `log/history/`.
