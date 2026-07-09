# DEPLOY — Cloudflare Pages

The SvelteKit app lives at the repo root and builds with
`@sveltejs/adapter-cloudflare`. Everything in M2 is prerendered static,
so there are no secrets or bindings to configure yet (those arrive with
logging in M3 — see the bottom of this file).

## One-time: create the Pages project

**Dashboard → Workers & Pages → Create → Pages → Connect to Git**, pick
this repo, then set:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | `SvelteKit` |
| Build command | `npm run build` |
| Build output directory | `.svelte-kit/cloudflare` |
| Root directory | `/` (repo root — leave blank) |

### Environment variables (Build settings → Variables)

| Name | Value | Why |
|---|---|---|
| `NODE_VERSION` | `22` | Build needs Node ≥ 20; Pages defaults to 18. |

That's the whole M2 config. Push to `main` → Pages builds → live. The
content pipeline (`exercises.yaml`, `blocks/`, `programs/`) is parsed at
build time, so a content edit is just a commit + push (FLOWS §1).

### Compatibility (Settings → Functions)

- **Compatibility date:** set to today or later (e.g. `2025-01-01`).
- **Compatibility flags:** add `nodejs_compat`.

All M2 routes are prerendered to static files (see
`.svelte-kit/cloudflare/_routes.json` — everything is in `exclude`, i.e.
served as static assets, the `_worker.js` is a fallback). The flag costs
nothing now and is required once server routes (`/api/sync`, auth) ship
in M3.

## Deploy without Git (optional)

```sh
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name switchback
```

## Verify a deploy

- `/` renders today's session card (recomputed client-side to the
  viewer's date).
- `/api/health` returns build health JSON — check `warnings` and
  `unresolved.count` after content edits (FLOWS §1.3; never fatal).
- Lighthouse → Installable (PWA). See the icon note below.

## PWA icons

M2 ships a single maskable **SVG** app icon (`static/icons/app-icon.svg`)
referenced from `static/manifest.webmanifest`. Modern Chrome/Android
accept SVG icons for installability. If you want raster fallbacks for
older engines, generate `icon-192.png` / `icon-512.png` from the SVG
(any rasterizer, e.g. `rsvg-convert -w 512 static/icons/app-icon.svg >
static/icons/icon-512.png`) and add them to the manifest `icons` array.

## Custom domain

Pages project → **Custom domains → Set up a domain**. Cloudflare manages
the cert automatically. No app change needed.

## Coming in M3 (not yet wired — noted so the project is ready)

Logging needs a D1 database and auth secrets:

- **D1:** create a database, then bind it as `DB` (Pages → Settings →
  Functions → D1 database bindings). Schema is in FLOWS §11.
- **Secrets:** `BOOTSTRAP_TOKEN` (passkey registration gate, FLOWS §4).
- `/api/*` routes will opt out of prerender (`export const prerender =
  false`) and run as Pages Functions — that's what `nodejs_compat` above
  is for.
