# Taxonomy

## Structural tags (from the spreadsheet, authoritative)
- `category`: athleticism · conditioning · prehab-mobility · strength-hypertrophy
  (plus snowboard-skills · hockey-skills from `skills.yaml`)
- `group`: section header within a sheet (e.g. "Braking Mechanics", "Plyos")
- `subgroup`: nested label where the sheet had one (e.g. "Lower / Isometrics / Overcoming")

## Derived tags (generated at build, no yaml)
- `body`: the body part, normalized from `group`/`subgroup` by
  `src/lib/content/body.ts`. The sheets already name the body part — they
  just name it in `group` on one sheet ("Chest") and in `subgroup` on
  another ("Ankle") — so this is a normalization, not a judgement call.
  Vocabulary, head to toe:

      full body · upper body · chest · back · shoulders · arms ·
      wrists & forearms · core · lower body · hips & glutes · quads ·
      hamstrings · adductors · calves & ankles

  `upper body` / `lower body` are for sheets that are deliberately generic
  (plyos, "Legs / All"). Where a sheet says nothing at all — conditioning's
  flat 69-entry "Plug-and-Play" list — name keywords fill in, and *only*
  there: a sheet label always wins over a keyword, so "Squat jumps" under
  Plyos stays `lower body` instead of being re-read as quads.

  The library is grouped by `category` then `body`; both are facets on
  `/library` and both are searchable there and in the session picker.

## Inferred tags (generated from names — review recommended)
- `modifiers`: unilateral (SL/SA/uni), bodyweight, isometric

Removed: `equipment` (was parsed from name tokens — DB, KB, LM, sled, …).
It never earned its place as a facet; body part replaced it.

## Suggested next pass (do with Claude, review by hand)
- `sports`: [mtb, climbing, snowboard, hockey, firefighting] — mostly
  derivable from group + judgment (e.g. Braking Mechanics → mtb/snowboard)
- `pattern`: hinge, squat, lunge, push-v, push-h, pull-v, pull-h,
  carry, rotation, anti-rotation, jump, bound, sprint
- Dedup: a few exercises appear in both strength-hypertrophy and
  Plug-and-Play (e.g. kettlebell swings) — merge or cross-reference.
- The conditioning sheet's `subgroup` column is misaligned in the source
  xlsx ("Bike" carries subgroup "Basketball"). Harmless today — nothing
  reads conditioning subgroups — but fix it at the next import.

## Abbreviations
DB dumbbell · KB kettlebell · BB barbell · LM landmine · MB med ball ·
SA single arm · SL single leg · SS split stance/single side · TB trap bar ·
SM smith machine · TRX suspension · BW bodyweight · GHD glute-ham developer ·
TKE terminal knee extension · COD change of direction · RFE rear foot elevated ·
AMRAP as many reps as possible · AMSAN as many sets as needed ·
EMOM every minute on the minute · h/e (running) hard/easy
