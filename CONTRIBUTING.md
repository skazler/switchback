# Editing the substrate

All authored content is plain text in this repo — there is no in-app
editor by design (README "Access model"). You change content by editing
files and pushing; the build (FLOWS §1) recompiles and deploys. This doc
is the how-to for the three content types.

## Add an exercise (a "move")

Append an entry under `exercises:` in `exercises.yaml`:

```yaml
  - name: "Copenhagen plank"      # display name; programs reference this
    id: copenhagen-plank          # stable kebab-case slug, UNIQUE
    category: prehab-mobility     # athleticism · conditioning · prehab-mobility · strength-hypertrophy
    group: "Adductors"            # section label (free text)
    subgroup: "Isometrics"        # optional nested label
    note: "Short lever to start"  # optional
    equipment: [bench]            # optional; tokens like DB, KB, BB, band…
    modifiers: [unilateral]       # optional; unilateral · bodyweight · isometric
    urls:                         # optional; first url is the link target
      - "https://www.instagram.com/reel/…"
```

Rules that matter:

- **`id` is identity.** Keep it unique and stable — logs (M3) reference
  exercises by id. If two entries share an id they're treated as the same
  move and merged at build (urls/equipment unioned), surfaced as a warning
  at `/api/health`. Use that only for genuine cross-listings of one move.
- **`name` is what programs link against.** A program table cell like
  `COPENHAGEN PLANK` resolves to this entry by case-insensitive match on
  `name` (a trailing footnote `*` is ignored). No match → renders as plain
  text and is listed in `/api/health` warnings (never fails the build).
  So: to make a program name clickable, ensure an exercise `name` matches.

## Add a block

Blocks are reusable chunks a program references by name (literal circuits,
or "pick 1–2 from…" menus). Create `blocks/<id>.md`:

```markdown
---
id: adductor-work
title: Adductor Work            # what a program cell matches against
type: prehab-menu               # prehab-menu · choice-menu · conditioning-menu · conditioning-block
appears-as: "ADDUCTOR WORK — 2 sets"   # optional; how it reads in a table
---

Pick 1–2 from library `prehab-mobility` → subgroup `Adductors`: …
```

A program cell `ADDUCTOR WORK` then resolves to this block (matched on
`title`, or the part of `appears-as` before " — ").

## Add or evolve a program

Create `programs/<id>.md` (or `programs/archive/<id>.md`). Front matter:

```yaml
---
id: 2026-q3                 # stable; referenced by logs
title: "2026 Q3 — …"
status: active              # exactly ONE program may be active
purpose: Conditioning base  # groups plans on /routes
level: build                # base · build · peak (facet on /routes)
series: quarterly-base      # lineage — ties versions of one plan together
start: 2026-03-30           # ISO date, a Monday (week numbering)
phases:                     # optional — lights up the elevation profile
  - {label: base,  weeks: [1, 8],  load: 3}
  - {label: build, weeks: [9, 14], load: 6}
  - {label: peak,  weeks: [15, 16], load: 8, summit: true}
---
```

Body: prose overview, then one `##` section per training day. The day's
weekday is encoded in an HTML comment — `M · T/Tu · W · Th · F · Sa · Su`:

```markdown
## lower strength  <!-- T lower strength -->

| Block | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| Lifts | BB RDL | 3 | 6 to 8 | :90 | |
| Squat Pattern | BOX SQUAT | 3 | 5 | 3:00 | |
```

The six columns are fixed (matched by header, order-tolerant). Exercise
cells resolve to the library / blocks as above.

**Evolving a plan over time:** give the new version the same `series` and a
new `start`; keep one file per version if you want to browse the history on
`/routes`, or (per README) keep one file per lineage and let git history
carry the evolution. The `/routes` view groups by `series` and shows the
newest as the head with older versions beneath.

## Build guardrails (fail the deploy)

- more than one program with `status: active`
- a day heading whose weekday code isn't one of the letters above

Unresolved exercise names and merged duplicate ids are **warnings**, not
failures — check them at `/api/health` after a content change.

## Check locally before pushing

```
npm run build     # runs the guardrails
npm test          # pipeline + today-resolution tests
```
