import type { Exercise, Block, ResolvedRef, Intensity } from './types';

/**
 * Normalize a name for case-insensitive exact matching (FLOWS §1.3).
 * Programs write names in ALL-CAPS with the odd trailing footnote `*`;
 * the library stores mixed case. Collapse to a comparable key.
 */
export function normalizeName(raw: string): string {
	return raw
		.replace(/\*+/g, ' ') // footnote markers
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/** Build a name → ref resolver over the library and the block set. */
export function buildResolver(
	exercises: Exercise[],
	blocks: Block[]
): (name: string) => ResolvedRef {
	const byExercise = new Map<string, Exercise>();
	for (const ex of exercises) {
		const key = normalizeName(ex.name);
		if (!byExercise.has(key)) byExercise.set(key, ex);
	}

	const byBlock = new Map<string, Block>();
	for (const b of blocks) {
		// A block can be referenced by its title or the leading part of
		// its `appears-as` string (before any " — N sets" qualifier).
		const keys = new Set<string>([normalizeName(b.title)]);
		if (b.appearsAs) keys.add(normalizeName(b.appearsAs.split('—')[0]));
		for (const k of keys) if (k && !byBlock.has(k)) byBlock.set(k, b);
	}

	return (name: string): ResolvedRef => {
		const key = normalizeName(name);
		if (!key) return null;
		const ex = byExercise.get(key);
		if (ex) return { kind: 'exercise', id: ex.id, name: ex.name, url: ex.urls?.[0] };
		const b = byBlock.get(key);
		if (b) return { kind: 'block', id: b.id, title: b.title };
		return null;
	};
}

/**
 * Smallest number implied by a reps string ("6 to 8" → 6, ">25" → 25,
 * "3 to 5" → 3). Returns undefined for AMRAP/AMSAN/empty.
 */
export function minReps(reps: string | undefined): number | undefined {
	if (!reps) return undefined;
	const nums = reps.match(/\d+/g);
	if (!nums) return undefined;
	return Math.min(...nums.map(Number));
}

const GREEN = /prehab|rehab|mobility|warm|zone ?2|scapul|wrist|ankle|rotator|cuff|activation|airplane/i;
const HARD = /sprint|heavy|anchor|max effort|1rm|test/i;
const MAX = /fireground|complex|circuit|simulation/i;

/**
 * Default intensity heuristic (DESIGN.md "Intensity system"):
 * prehab & zone 2 → green, 8–12 accessories → blue,
 * ≤5-rep anchors & sprints → black, circuits/tests → double-black.
 * The program author can always override in the future; this is the fallback.
 */
export function intensityFor(row: {
	group?: string;
	name: string;
	reps?: string;
}): Intensity {
	const hay = `${row.group ?? ''} ${row.name}`;
	if (MAX.test(hay)) return 'double-black';
	if (HARD.test(hay)) return 'black';
	const low = minReps(row.reps);
	if (low !== undefined && low <= 5) return 'black';
	if (GREEN.test(hay)) return 'green';
	return 'blue';
}

const RANK: Record<Intensity, number> = {
	green: 0,
	blue: 1,
	black: 2,
	'double-black': 3
};

/** Hardest marker in a set of rows → the day badge. */
export function dayMarker(markers: Intensity[]): Intensity {
	if (markers.length === 0) return 'blue';
	return markers.reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
}
