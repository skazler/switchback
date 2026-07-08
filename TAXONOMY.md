# Taxonomy

## Structural tags (from the spreadsheet, authoritative)
- `category`: athleticism · conditioning · prehab-mobility · strength-hypertrophy
- `group`: section header within a sheet (e.g. "Braking Mechanics", "Plyos")
- `subgroup`: nested label where the sheet had one (e.g. "Lower / Isometrics / Overcoming")

## Inferred tags (generated, review recommended)
- `equipment`: parsed from name tokens (DB, KB, LM, sled, band, bosu, …)
- `modifiers`: unilateral (SL/SA/uni), bodyweight, isometric

## Suggested next pass (do with Claude, review by hand)
- `sports`: [mtb, climbing, snowboard, hockey, firefighting] — mostly
  derivable from group + judgment (e.g. Braking Mechanics → mtb/snowboard)
- `pattern`: hinge, squat, lunge, push-v, push-h, pull-v, pull-h,
  carry, rotation, anti-rotation, jump, bound, sprint
- Dedup: a few exercises appear in both strength-hypertrophy and
  Plug-and-Play (e.g. kettlebell swings) — merge or cross-reference.

## Abbreviations
DB dumbbell · KB kettlebell · BB barbell · LM landmine · MB med ball ·
SA single arm · SL single leg · SS split stance/single side · TB trap bar ·
SM smith machine · TRX suspension · BW bodyweight · GHD glute-ham developer ·
TKE terminal knee extension · COD change of direction · RFE rear foot elevated ·
AMRAP as many reps as possible · AMSAN as many sets as needed ·
EMOM every minute on the minute · h/e (running) hard/easy
