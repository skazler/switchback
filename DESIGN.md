# SWITCHBACK — design language

Deliberately the opposite of MAINSPRING (dark academia / horological /
ornamental). SWITCHBACK looks like the things that already live in its
domain: race bibs, chairlift signage, GPS head units, trail markers.
**Athletic, clean, minimal, sharp, fast.**

Where MAINSPRING says *archive*, SWITCHBACK says *stopwatch*.

## Principles

1. **Numbers are the heroes.** Weight, reps, rest clock render big
   enough to read from the bar. Condensed display type, tabular
   figures everywhere.
2. **One accent, worked hard but capped.** Blaze orange does exactly
   four jobs: section rules, active state, completed sets, primary
   action. Never headings, never icons, never decoration. If a fifth
   job appears, something else must give one up.
3. **Sharp.** `border-radius: 0` globally. Hairlines for structure,
   2px rules for section breaks. No cards, no shadows, no gradients,
   no texture. Whitespace is the container.
4. **Fast is an aesthetic.** No transition over 100ms. No eased
   flourishes, no skeleton shimmer. State changes land instantly.
5. **Gym ergonomics are design.** Tap targets sized for chalked
   thumbs (≥44px real, 30px only in mockups). One-hand reach layout.
   Glanceable at arm's length mid-set.
6. **Dark is the default.** Orange numerals on near-black = race
   clock. Light mode is the same system inverted ("paper mode"),
   orange unchanged.

## Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Display / numerals / headlines | Barlow Condensed | 500, 600 | race-clock energy |
| Body / labels | Archivo | 400, 500 | geometric, plain |

- `font-variant-numeric: tabular-nums` globally.
- Microlabels: 10–11px, `letter-spacing: 0.14em`, muted color.
- Both fonts OFL — Google Fonts or self-host.

## Color

### Dark (default)
| Token | Value | Use |
|---|---|---|
| `--field` | `#131312` | page background |
| `--field-raised` | `#1B1B19` | active/highlighted row |
| `--ink` | `#FAFAF8` | primary text ("paper") |
| `--muted` | `#8A8983` | secondary text, microlabels |
| `--hairline` | `#33322F` | 0.5px structural rules |
| `--blaze` | `#E8590C` | THE accent (rules, active, done-sets, primary action) |
| `--blaze-lit` | `#F1661A` | luminous numerals only (rest clock) |
| on-blaze text | `#131312` | ink on orange fills |

### Light ("paper mode" — same system inverted)
| Token | Value |
|---|---|
| `--field` | `#FAFAF8` |
| `--field-raised` | `#FFFFFF` |
| `--ink` | `#111110` |
| `--muted` | `#6B6A66` |
| `--hairline` | `#D6D4CE` |
| `--blaze` | `#E8590C` (unchanged) |
| section rules | `#111110` ink (orange reserved for active/done/action in light) |

## Intensity system — trail markers

Effort/intensity is encoded as ski trail difficulty. Flat geometric
shapes; zero decorative cost; Colorado in the bones.

| Marker | Meaning | Dark fill | Light fill |
|---|---|---|---|
| ● green circle | easy — zone 2, prehab, warmups | `#97C459` | `#3B6D11` |
| ■ blue square | moderate — accessories, standard sessions | `#85B7EB` | `#185FA5` |
| ◆ black diamond | hard — heavy anchors, sprints | `#131312` + 1.4px paper stroke | `#111110` |
| ◆◆ double black | max — fireground circuit, test days | same, doubled | same, doubled |

Applies per-exercise and per-session (day badge in header).
Mapping lives with the program author; default heuristics: prehab &
zone 2 → green, 8–12 accessories → blue, ≤5-rep anchors & sprints →
black, circuits/tests → double black.

## Layout patterns (from the session-screen mockup)

- Header: microlabel line (day · program · week) over condensed
  session title; day-difficulty badge right-aligned.
- Clock strip: rest clock (blaze-lit) | session clock (ink) |
  Log set button (blaze fill, ink text) — the highest-contrast
  object on screen, always thumb-reachable.
- Active exercise: 3px blaze left rule + raised field. No card.
- Set pips: 30–44px squares; done = blaze fill + ink numeral,
  pending = 1.5px ink outline.
- Exercise rows: hairline-separated list, condensed name + muted
  prescription (`3 × 6–8 · rest :90`), marker right-aligned.
- Footer: 2px rule, wordmark microlabel left ("Switchback"), progress right
  (`2 of 4 done ▲`).

## Starter CSS

```css
:root {
  --field: #131312; --field-raised: #1B1B19;
  --ink: #FAFAF8; --muted: #8A8983; --hairline: #33322F;
  --blaze: #E8590C; --blaze-lit: #F1661A;
  --radius: 0;
}
[data-mode="paper"] {
  --field: #FAFAF8; --field-raised: #FFFFFF;
  --ink: #111110; --muted: #6B6A66; --hairline: #D6D4CE;
  --blaze-lit: #E8590C;
}
* { border-radius: 0 !important; transition-duration: 0ms; }
body {
  background: var(--field); color: var(--ink);
  font-family: 'Archivo', sans-serif;
  font-variant-numeric: tabular-nums;
}
h1, h2, .display, .numeral {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 600;
}
```

## Anti-patterns

- A second accent color. There is no second accent color.
- Rounded anything.
- Shadows, gradients, glassmorphism, texture.
- Animations that ease. Loading spinners where instant render is possible.
- Orange text in body copy or headings.
- Serifs (that's MAINSPRING's voice).

## Logo

The mark is a switchback seen from above: three diagonal climbing
traverses (~20 degree grade) joined at two acute hairpins, one
stroked path (miter joins spike into natural hairpin apexes; butt
caps; no curves, no right angles). The final traverse runs longer and steeper than the first two and
its arrowhead overshoots the hairpin extents — the highest,
rightmost point of the mark is the direction of travel. Read
bottom-to-top. It leads as a trail glyph; the S is secondary.

- `assets/logo.svg` — blaze on transparent (default, for dark)
- `assets/logo-paper.svg` — ink variant for light surfaces
- Holds at 16px (favicon-safe).
- Permitted animation exception: stroke may draw itself
  bottom-to-top on app load (`stroke-dashoffset`); nothing else.
- Wordmark lockup: mark + "Switchback", Barlow Condensed 600,
  letter-spacing 0.04em.

## Concept shelf — mountain culture (captured 2026-07-07, NOT yet spec)

Ideas from concept art, approved in spirit but not committed to the
build. Principle: mountain culture enters through information design,
not decoration. Promote items to spec individually as they're built.

### 1. Elevation-profile progress bar  ← build first
Program progress rendered as a route elevation profile, not a linear
bar. Weekly load maps to elevation: deload weeks are visible dips,
build phases climb, race/test day is the summit with a small blaze
flag. Completed portion: blaze fill + blaze-lit stroke; remaining:
raised-field fill + hairline stroke; current position: paper dot.
Phase microlabels beneath (base / build / peak). Worth building first
because it makes the data more legible, not just prettier — the
periodization structure becomes visible at a glance.

### 2. Topo contour header texture
Faint topographic contour hairlines behind header/hero areas only.
Contrast whisper-quiet (~#2A2A27 on #131312 — barely above the
hairline token). This is the single sanctioned decorative element in
the system; if it ever appears outside headers, remove it everywhere.

### 3. Trailhead wayfinding navigation
Home navigation as stacked directional trail signs: full-width bars
with condensed label left, → right. Today's session is the one
blaze-filled sign (ink text on orange); all others are hairline-
outlined. Counts/metadata ride as muted suffixes ("Library · 536
moves").

### 4. Summit register (PR system)
PRs displayed as a summit log. Marker: triangle peak outline;
achieved PR = blaze outline with filled snowcap + "▲ PR" tag;
goal not yet hit = muted outline, no snowcap, labeled "unclimbed".
Rows: big condensed numeral + lift + all-time/goal microlabel.
Maps PRs onto peak-bagging: discrete summits, clear endpoints,
logged when climbed.

### Vocabulary
| UI concept | Term |
|---|---|
| home | Trailhead |
| program | Route |
| exercise library | Library (exercises = "moves") |
| PR history | Summit log |
| race/test day | Summit |
| deload | (visible as profile dip; no cute name needed) |

Use the vocabulary sparingly — labels and navigation, never body
copy. If a term needs explaining, use the plain word instead.
