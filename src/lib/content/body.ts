// Body-part tagging for the library (TAXONOMY.md).
//
// The spreadsheet already carries this information — it just carries it in a
// different column depending on the sheet. Strength & hypertrophy names the
// body part in `group` ("Chest", "Shoulders") or `subgroup` ("Quads",
// "Triceps"); prehab/mobility names it in `subgroup` ("Ankle", "Wrist"). So
// the table below is a NORMALIZATION of the sheet's own labels onto one
// vocabulary — the same job resolve.ts does for names, not a judgement call.
//
// Where the sheet genuinely doesn't say (conditioning's "Plug-and-Play" is a
// flat list of 69 moves), we fall back to name keywords. That fallback runs
// ONLY on entries that land on `full body`, so a label the sheet was explicit
// about — including a deliberate "lower body" for the plyo sheets — is never
// overridden by a keyword.

/** The body-part vocabulary, in the order the library displays it. */
export const BODY_PARTS = [
	'full body',
	'upper body',
	'chest',
	'back',
	'shoulders',
	'arms',
	'wrists & forearms',
	'core',
	'lower body',
	'hips & glutes',
	'quads',
	'hamstrings',
	'adductors',
	'calves & ankles'
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

const BODY_RANK = new Map<string, number>(BODY_PARTS.map((b, i) => [b, i]));

/** Sort key for a body part — unknown values sort last. */
export function bodyRank(b: string | undefined): number {
	return BODY_RANK.get(b ?? '') ?? BODY_PARTS.length;
}

/** Category display order. Unlisted categories sort last, A–Z. */
export const CATEGORY_ORDER = [
	'strength-hypertrophy',
	'athleticism',
	'conditioning',
	'prehab-mobility',
	'snowboard-skills',
	'hockey-skills'
] as const;

const CATEGORY_RANK = new Map<string, number>(CATEGORY_ORDER.map((c, i) => [c, i]));

export function categoryRank(c: string | undefined): number {
	return CATEGORY_RANK.get(c ?? '') ?? CATEGORY_ORDER.length;
}

const CATEGORY_LABELS: Record<string, string> = {
	'strength-hypertrophy': 'Strength & hypertrophy',
	athleticism: 'Athleticism',
	conditioning: 'Conditioning',
	'prehab-mobility': 'Prehab / mobility',
	'snowboard-skills': 'Snowboard skills',
	'hockey-skills': 'Hockey skills'
};

export function categoryLabel(c: string | undefined): string {
	if (!c) return 'Uncategorized';
	return CATEGORY_LABELS[c] ?? c.replace(/-/g, ' ');
}

// ── the sheet's own labels → the vocabulary ─────────────────────────
// Matched against `subgroup` first, then `group`, lowercased.
const LABELS: Record<string, BodyPart> = {
	// strength & hypertrophy
	abs: 'core',
	arms: 'arms',
	biceps: 'arms',
	triceps: 'arms',
	forearms: 'wrists & forearms',
	back: 'back',
	chest: 'chest',
	shoulders: 'shoulders',
	shoulder: 'shoulders',
	legs: 'lower body',
	all: 'lower body', // "Legs / All" — squat patterns, not one muscle
	quads: 'quads',
	hamstrings: 'hamstrings',
	'posterior chain': 'hamstrings',
	adductors: 'adductors',
	'adductors (& groin)': 'adductors',
	calves: 'calves & ankles',

	// prehab / mobility
	ankle: 'calves & ankles',
	'lower legs (calves & soleus)': 'calves & ankles',
	'back (& core)': 'back',
	'hips (& glutes)': 'hips & glutes',
	'knees (& quads)': 'quads',
	wrist: 'wrists & forearms',
	full: 'full body',
	'neuromuscular coordination': 'full body',

	// athleticism
	core: 'core',
	'core/rotational': 'core',
	upper: 'upper body',
	lower: 'lower body',
	'lower / isometrics / overcoming': 'lower body',
	'agility (fast feet)': 'lower body',
	'braking mechanics': 'lower body',
	plyos: 'lower body',
	'depth drop & jump': 'lower body',
	switches: 'lower body',
	'plyo-agility (cod/quickness)': 'lower body',
	'speed drills': 'lower body',
	bounds: 'lower body',
	'sprints/speed/cod': 'lower body',
	'regular sprints': 'lower body',
	skips: 'lower body',
	'dynamic warmups': 'full body',
	'explosiveness/power': 'full body',

	// conditioning
	running: 'lower body',
	'plug-and-play': 'full body',
	'low intensity long duration & active recovery cardio': 'full body'
};

// ── name-keyword fallback ───────────────────────────────────────────
// First match wins, so the order IS the disambiguation: "hamstring curls"
// must reach `hamstrings` before `curl` reaches `arms`, and "bench press"
// must reach `chest` before "press" reaches `shoulders`.
const KEYWORDS: [BodyPart, RegExp][] = [
	// Sprints first: the "Row" in "Sprint (Bike, Row, Run, Sled Resisted)"
	// would otherwise read as a back exercise.
	['lower body', /\bsprints?\b|\bsprinting\b|hill sprint|\brunning\b/i],
	[
		'core',
		/\babs?\b|core|plank|crunch|sit-?\s?ups?|hollow|dragon flag|deadbug|russian twist|mountain climber|leg raise|woodchop|pallof|v-?ups?|toes.to.bar|l-?sit|turkish/i
	],
	['adductors', /adductor|copenhagen|groin/i],
	['calves & ankles', /calf|calves|soleus|ankle|tibialis|pogo/i],
	[
		'hamstrings',
		/hamstring|nordic|\brdl\b|romanian|good morning|leg curl|stiff-?\s?legged?|glute.?ham|\bghd\b/i
	],
	[
		'hips & glutes',
		/glute|hip thrust|hip flexor|clamshell|bridge|\bswings?\b|monster walk|fire hydrant|abductor|hip airplane/i
	],
	[
		'quads',
		/quad|squat|leg extension|lunge|step.?ups?|step.?downs?|sissy|spanish|wall sit|\btkes?\b|leg press/i
	],
	['chest', /bench|push-?\s?ups?|chest|\bfl(y|ys|ies)\b|\bdips?\b/i],
	[
		'back',
		/pull-?\s?ups?|chin-?\s?ups?|\brows?\b|pulldown|\blats?\b|pullover|rhomboid|scapular|face pull|renegade|gorilla/i
	],
	['arms', /bicep|tricep|\bcurls?\b|skullcrusher|kickback|pushdown/i],
	['wrists & forearms', /wrist|forearm|\bgrip\b|dead hang|farmers? carry|suitcase carry/i],
	[
		'shoulders',
		/shoulder|lateral raise|\bdelt|overhead press|push press|thruster|seesaw press|kneeling press|upright row|y-?raises?|t-?raises?|windmill/i
	]
];

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Body part for one library entry. `subgroup` beats `group` (it is the more
 * specific of the two sheet labels); if neither names a body part the entry
 * is `full body`, and only then do name keywords get a say — except on the
 * sport-skill sheets, where a move is a skill, not body-part work.
 */
export function bodyPartFor(ex: {
	name: string;
	category?: string;
	group?: string;
	subgroup?: string;
}): BodyPart {
	const labelled = LABELS[norm(ex.subgroup)] ?? LABELS[norm(ex.group)];
	if (labelled && labelled !== 'full body') return labelled;

	if (/-skills$/.test(norm(ex.category))) return 'full body';

	for (const [part, re] of KEYWORDS) if (re.test(ex.name)) return part;
	return labelled ?? 'full body';
}
