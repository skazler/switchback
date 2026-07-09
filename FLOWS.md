# SWITCHBACK — flow specification

Implementation spec for all user and system flows. Read alongside:
- `README.md` — architecture, access model, roadmap
- `DESIGN.md` — visual system (authoritative for all UI)
- `log/README.md` — D1 schema sketch
- `exercises.yaml`, `blocks/`, `programs/` — content model

Stack (decided, do not revisit): SvelteKit on Cloudflare Pages,
server routes on Workers, D1 for runtime data, IndexedDB as offline
write buffer, service worker for offline shell, WebAuthn passkey for
owner auth. Git repo is canonical for all authored content.

Roles: **owner** (Sky, exactly one) and **guest** (everyone else).

---

## 1. Content pipeline (system)

Trigger: push to main.

1. Cloudflare Pages builds the SvelteKit app.
2. Build step parses `exercises.yaml`, `blocks/*.md`, `programs/*.md`
   (front matter + body) into typed content. Fail the build on:
   duplicate exercise ids, program referencing unknown day format,
   more than one program with `status: active`.
3. Exercise-name resolution: program/block tables reference exercises
   by name (often ALL-CAPS in tables). Resolver: case-insensitive
   exact match on `name` → link to exercise (url, tags). Unresolved
   names render plain (no link), and the build emits a warnings list
   (`/api/health` exposes count) — do NOT fail the build on
   unresolved names; the corpus normalizes over time.
4. Static routes prerendered; API routes deploy as functions.

Program front matter contract (extend existing):
```yaml
id: 2026-q2          # stable, referenced by logs
title: "..."
status: active|archived
start: 2025-12-29    # ISO date, a Monday; enables week numbering
```

## 2. Routes (public read — no auth on any GET)

| Route | Content |
|---|---|
| `/` | Trailhead: today's session card (blaze sign), route, library, summit log, history (wayfinding stack per DESIGN.md concept 3) |
| `/route` | Active program: overview, elevation-profile progress (DESIGN.md concept 1), week table, day links |
| `/route/[day]` | Day view = session screen (read mode) |
| `/routes` | All programs incl. archive |
| `/library` | Exercise library, filter by category/group/equipment; each entry links out to its saved url(s) |
| `/log` | Session history (respecting privacy rules below) |
| `/summits` | Summit register: PRs + unclimbed goals |
| `/get` | Install page: platform-sniffed (Android → install prompt button; iOS → Add-to-Home-Screen illustrated steps; desktop → "just use the URL") |

Privacy: `site.config.ts` exposes `publicLogs: boolean` (default
true). Regardless of flag, session/set **notes are never rendered to
guests** — notes may contain personal context. Owner sees notes when
authenticated.

## 3. Today resolution (system)

1. Active program = the one with `status: active`.
2. `week = floor((today - start) / 7) + 1` in America/Chicago.
3. Day sheet = match today's weekday letter prefix (`M`, `T`, `W`,
   `Th`, `F`, `Sa`, `Su`) in the program's day headings.
4. No match (rest day / program has no sheet for today) → Trailhead
   shows "No route today" with links to route + history.

## 4. Owner onboarding (per device)

1. Owner visits `/auth` and enters the bootstrap token
   (`BOOTSTRAP_TOKEN`, a Workers secret) — required for every passkey
   registration; this is the only use of the token.
2. WebAuthn registration → credential stored in D1 `credentials`.
3. Session established: httpOnly signed cookie, 90-day rolling.
4. Subsequent visits on that device: passkey assertion → cookie.
5. Guests never see auth UI except a small "owner sign-in" footer
   link.

## 5. Session flow (owner, the core loop)

Entry: Trailhead → today's blaze sign, or `/route/[day]` → "Start
session".

1. **Start** creates a local session record (ULID id, date,
   program_id, day, started_at) in IndexedDB.
2. Session screen per DESIGN.md layout: clock strip (rest / session /
   Log set), active exercise raised with blaze rule, set pips.
3. **Log set**: primary button opens inline weight/reps entry
   (numeric keypads, previous values prefilled from last occurrence
   of this exercise in history — from local cache of recent history).
   Writes a `sets` row to IndexedDB. Starts rest timer from the
   prescription (e.g. `:90`, `3:00`); timer counts down in
   blaze-lit numerals; on zero, flash the clock strip — **no sound,
   no vibration in v1** (gym phones are silent; revisit on felt need).
4. **Performed instead**: on any exercise row, "swap" affordance →
   search library (local, from cached content) → chosen exercise id
   recorded in `performed_instead`; prescription display keeps the
   planned exercise struck-through per DESIGN (muted, not red).
5. **Skip set / skip exercise**: allowed, recorded implicitly by
   absence; no confirmation dialogs.
6. **Notes**: per-set optional, per-session at completion.
7. **Complete session** stamps `completed_at`, queues sync.
8. Duration cap: a session left open > 12h is auto-completed at last
   set time on next app open.

All of the above is fully offline-capable. No step touches network.

## 6. Sync flow (owner)

Buffer: IndexedDB stores `pending_sessions` / `pending_sets` with
client ULIDs.

1. Triggers: session complete, app foregrounded (`visibilitychange`),
   connectivity regained (`online`), manual pull-to-sync on `/log`,
   and every successful app load.
2. `POST /api/sync` with the full pending batch; cookie auth; 401 →
   keep buffer, show "sign in to sync" state (data never dropped).
3. Server upserts by ULID (idempotent — safe to retry the same batch).
4. 2xx → clear synced records from buffer. Partial failure → keep
   failed records, retry with exponential backoff (max 1h interval).
5. UI: subtle sync state in footer — "N sets local ▲" when pending,
   nothing when clean. Never modal, never blocking.
6. Storage protection: request
   `navigator.storage.persist()` on first owner login; if pending
   buffer age > 24h, footer state turns blaze as a nudge.

Conflict policy: none needed — single writer, append-only, ULIDs.
Last-write-wins on the rare re-sync of an edited note.

## 7. Guest usage

1. All GETs work identically for guests.
2. Guest taps "Start session" → same session flow, IndexedDB only.
   Persistent footer badge: "Local only — nothing saves to the
   server" (muted, not blaze).
3. No sync trigger ever fires for guests; `/api/sync` without a valid
   cookie is 401 regardless.
4. `/log` for a guest shows THEIR local sessions (from their
   IndexedDB) above the owner's public history, clearly separated.
5. "Clear my local data" action in guest footer.

## 8. History, records, analytics (owner-facing, mostly public)

1. `/log`: reverse-chron sessions; owner sees notes, guests don't.
2. Volume rollup: weekly sets by muscle group — derived by mapping
   exercise → group via `exercises.yaml` tags (category/group);
   replaces the old AAR grid. SQL over D1, rendered as the DESIGN
   elevation-adjacent bar rows. `log/volume-history.csv` is imported
   once into D1 as historical baseline (one-off script, part of
   milestone 3).
3. `/summits`: 
   - Achieved: per-exercise best weight at each rep count from
     `sets`; display top single + computed e1RM (Epley), e1RM always
     labeled "est."
   - Goals ("unclimbed"): authored in `goals.yaml` in the repo
     (documents door): `- exercise: clean, target: 225, unit: lb`.
   - A new set exceeding a best triggers the "▲ PR" treatment on the
     session screen (local computation) and in the register.

## 9. Program editing (owner, out-of-app by design)

Not implemented in the app. Documented paths: Claude Code (remote
session from mobile) against the repo, or github.dev / GitHub mobile.
Push → pipeline (§1) → live. The app MUST tolerate: program renamed
or archived while logs reference its id (render logs with the id
string and a "route archived" note — never 404 a log view).

## 10. Service worker / offline strategy

1. Precache on install: app shell (HTML/JS/CSS), fonts (self-hosted
   Barlow Condensed + Archivo — do not hit Google Fonts at runtime),
   logo, and the compiled content JSON for the ACTIVE program +
   exercise library.
2. Navigation + content: stale-while-revalidate (instant open,
   refresh in background; new content applies next open).
3. `/api/*`: network-first, no cache for POST; GET history responses
   cached with an "as of <time>" stamp rendered when served stale.
4. New deploy → SW `waiting`; apply on next cold open (no "update
   available" toast — DESIGN forbids nagging).
5. iOS eviction mitigation is §6.6; local data is a buffer, never the
   only copy for long.

## 11. D1 schema (supersedes log/README.md sketch)

```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY, public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- client ULID
  date TEXT NOT NULL, program_id TEXT, day TEXT,
  started_at TEXT, completed_at TEXT, notes TEXT
);
CREATE TABLE sets (
  id TEXT PRIMARY KEY,              -- client ULID
  session_id TEXT NOT NULL REFERENCES sessions(id),
  exercise_id TEXT NOT NULL,        -- exercises.yaml id (planned)
  performed_instead TEXT,           -- exercises.yaml id (actual, if swapped)
  set_num INTEGER, reps INTEGER, weight REAL, unit TEXT DEFAULT 'lb',
  rpe REAL, duration_s INTEGER, notes TEXT, logged_at TEXT NOT NULL
);
CREATE TABLE volume_baseline (      -- one-off import of AAR history
  week TEXT NOT NULL, muscle_group TEXT NOT NULL, sets REAL
);
CREATE INDEX idx_sets_exercise ON sets(exercise_id, weight);
CREATE INDEX idx_sessions_date ON sessions(date);
```

## 12. Failure modes (must handle, not crash)

- Sync 401 mid-flush → keep buffer, prompt re-auth, never drop.
- Offline cold start on a device that has synced before → serve
  cached shell + cached active program; history shows "as of" stamp.
- Active program's `start` in the future → week 0, show "Route
  begins <date>".
- Exercise id in a log no longer in `exercises.yaml` → render the id
  slug as plain text.
- Two tabs open → BroadcastChannel to serialize sync (or accept
  idempotent double-POST; ULIDs make it safe).

## 13. Explicitly out of scope (do not build)

- In-app program/library editing (any role)
- Accounts, multi-user, sharing/social of any kind
- Plate calculators, warm-up-set generators, exercise videos hosted
  locally (links out only), timers beyond the rest clock
- Push notifications
- Capacitor / app-store packaging
- Any second accent color, rounded corner, shadow, or eased
  transition (see DESIGN.md anti-patterns)

## 14. Milestones & acceptance

**M2 — render (ship first):** pipeline §1, routes §2 (read-only,
no session flow), today resolution §3, `/get`. Accept: phone loads
`/`, today's session readable at arm's length, exercise links work,
lighthouse PWA installable, elevation profile renders from program
front matter.

**M3 — log:** §4–6, §10, §11, AAR import. Accept: full session
logged in airplane mode, syncs on reconnect, visible in `/log` from
a second device; buffer survives app kill.

**M4 — public polish:** §7 guest mode + badge, §8 summits +
volume rollup, notes privacy, demo-readiness. Accept: stranger's
phone can browse, run a guest session, and nothing lands in D1.

Work in a feature branch per milestone; PR descriptions reference
section numbers from this file.
