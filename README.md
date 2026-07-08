# SWITCHBACK

Training system: plans, exercise library, and (eventually) logging.
Named for how you climb terrain too steep to take head-on:
obliquely, in structured legs, each one setting up the next.
Which is what a training plan is.

Plain-text substrate for all training programming. Migrated from
Google Sheets on 2026-07-07. Principle: **every kind of data lives in
the substrate that matches its mutation pattern** — authored documents
in git, runtime events in SQLite (D1).

## Layout

```
exercises.yaml      atoms — the exercise library (536 entries, tagged)
blocks/             molecules — reusable chunks programs are built from
programs/           compositions — one markdown file per program
  2026-q2.md          status: active
  archive/            past programs (FF S&C, SB transition)
log/                runtime data (volume history CSV; D1 schema notes)
TAXONOMY.md         tag vocabulary + review notes
DESIGN.md           UI design language for milestones 2-3
FLOWS.md            implementation flow spec (hand to implementing agent)
```

## Conventions

- **Exercise identity** is the `id` slug in `exercises.yaml`. Programs
  and blocks reference exercises by name; the future renderer resolves
  name → id → url.
- **Programs** carry YAML front matter (`id`, `title`, `status`).
  Exactly one program has `status: active`. Versioning is git history —
  no more `_v3` filenames. Commit messages carry the "why" of changes.
- **Blocks** are either literal prescriptions (fireground circuit,
  complex training) or menus ("pick 1–2 from …") that resolve against
  the library. When a program says `ROTATOR CUFF WORK`, that's a block
  reference.
- ALL-CAPS entries in program tables = as written in the original
  sheets; a normalization pass to library ids is a good next step.

## Composing a new program

Point Claude (Code or a Project with this repo) at the repo:
"Draft a <goal> block, constraints <schedule>, draw only from
exercises.yaml and blocks/, follow the conventions in programs/."
Review the diff, commit.


## Access model (decided 2026-07-07)

Two roles, one gate. Single-tenant by design.

| Capability | Owner | Everyone else |
|---|---|---|
| View programs, library, blocks | yes | yes |
| View logs, records, summit register | yes | yes (public by default; `public_logs` flag exists from day one) |
| Log sessions -> synced to D1 | yes (passkey per device) | no — guest logging writes to their own IndexedDB only, never syncs; UI shows a persistent "local only" badge |
| Edit programs / library | via git commits only (GitHub creds) | no |
| Mutate D1 in any way | authenticated server routes only | 401 |

Notes:
- D1 is the canonical store of logs; any authenticated browser sees
  the same history. Devices are disposable.
- Programs have no in-app write path for anyone, owner included —
  documents change only through the repo. Two write doors, two keys.
- Mid-session deviations (substitutions, cut sets, notes) are LOG
  data, not program edits: "performed instead" + notes fields in the
  logging client. Plan vs actual stays separate and queryable.
- Phone program edits: Claude Code remote session against the repo
  (preferred) or github.dev / GitHub mobile. An owner-only structured
  edit route that commits via the GitHub API is deferred Tier 3 —
  build only if the above proves too slow in practice.
- Guest mode doubles as the portfolio demo: full product feel,
  zero accounts, zero stored data.

## Roadmap (agreed architecture)

1. ✅ This substrate
2. ✅ SvelteKit app on Cloudflare Pages — renders active program,
   hyperlinks exercises via the library (visual spec: DESIGN.md).
   Read-only routes, today resolution, elevation profile, `/get`.
3. PWA logging client — IndexedDB buffer → server route → D1
   (schema sketch in `log/README.md`)
4. Volume/progression analytics as SQL over D1; retire manual AAR grid

## App (milestone 2)

SvelteKit lives at the repo root; the content substrate is parsed at
build time (no separate content DB). Commands:

```
npm install
npm run dev        # local dev
npm run build      # prerender all routes (fails on the §1 guardrails)
npm run preview    # serve the production build
npm test           # content pipeline + today-resolution tests
```

Deploy to Cloudflare Pages: see `DEPLOY.md`. Build health (including the
unresolved-name warnings from the pipeline) is exposed at `/api/health`.
