// Presentation helpers for session tables — kept out of the component so
// they're unit-testable.
import type { SessionRow } from './content/types';

const stripMd = (s: string) => s.replace(/\*\*/g, '').trim();

/** Display name without the trailing footnote `*` (a spreadsheet artifact). */
export function displayName(name: string): string {
	return name.replace(/\s*\*+\s*$/, '').trim();
}

/** A note without its leading footnote `*` — the note IS the asterisk's meaning. */
export function displayNote(note: string | undefined): string {
	return (note ?? '').replace(/^\s*\*+\s*/, '').trim();
}

export type RowKind =
	| { kind: 'session'; label: string } // two-a-day: first / second session of the day
	| { kind: 'week'; label: string } // week-to-week rotation (Week A / Week B)
	| { kind: 'group'; label: string } // section subhead
	| { kind: 'ex'; row: SessionRow };

const SESSION = /^session\s*\d+/i;
const WEEK = /^week\s+[a-z0-9]+$/i;

/** Is this a "choice" cell that should point at the library? */
export function isChoice(name: string): boolean {
	return /\bchoice\b/i.test(name);
}

// A choice cell that names a body part ("LOWER ACCESSORY LIFT CHOICE",
// "QUAD EXERCISE CHOICE") can filter the library exactly instead of running a
// text search — so map the words it uses onto the body-part vocabulary first.
// Keys are what programs actually write; values are BODY_PARTS members.
const BODY_WORDS: Record<string, string> = {
	upper: 'upper body',
	lower: 'lower body',
	chest: 'chest',
	back: 'back',
	lat: 'back',
	lats: 'back',
	shoulder: 'shoulders',
	shoulders: 'shoulders',
	delt: 'shoulders',
	delts: 'shoulders',
	arm: 'arms',
	arms: 'arms',
	bicep: 'arms',
	biceps: 'arms',
	tricep: 'arms',
	triceps: 'arms',
	wrist: 'wrists & forearms',
	wrists: 'wrists & forearms',
	forearm: 'wrists & forearms',
	forearms: 'wrists & forearms',
	core: 'core',
	abs: 'core',
	hip: 'hips & glutes',
	hips: 'hips & glutes',
	glute: 'hips & glutes',
	glutes: 'hips & glutes',
	quad: 'quads',
	quads: 'quads',
	hamstring: 'hamstrings',
	hamstrings: 'hamstrings',
	adductor: 'adductors',
	adductors: 'adductors',
	groin: 'adductors',
	calf: 'calves & ankles',
	calves: 'calves & ankles',
	ankle: 'calves & ankles',
	ankles: 'calves & ankles'
};

const CHOICE_STOP = new Set([
	'choice', 'exercise', 'exercises', 'movement', 'work', 'the', 'a', 'of', 'and',
	'focus', 'optional', 'accessory', 'lift', 'lifts', 'session', 'anything'
]);

/** Best library link for a choice cell — the body part it names, or failing
 *  that a text search on its most specific non-generic word. */
export function choiceHref(row: SessionRow): string {
	const words = displayName(row.name)
		.toLowerCase()
		.replace(/[*()/&]/g, ' ')
		.split(/\s+/)
		.filter((w) => w && /^[a-z]/.test(w));

	const groupWords = row.group
		? stripMd(row.group).toLowerCase().replace(/[*()/&]/g, ' ').split(/\s+/)
		: [];

	for (const w of [...words, ...groupWords]) {
		const body = BODY_WORDS[w];
		if (body) return `/library?body=${encodeURIComponent(body)}`;
	}

	// The group cell gets the same stop-word treatment as the name: falling
	// back to it raw turned "Accessory | Lift choice" into ?q=accessory,
	// which searches for the word "accessory" rather than showing the
	// accessories. No specific term left ⇒ open the whole library.
	const term = [...words, ...groupWords].find((w) => !CHOICE_STOP.has(w)) ?? '';
	return term ? `/library?q=${encodeURIComponent(term)}` : '/library';
}

/**
 * The Block label each row of a *session* belongs to, in order.
 *
 * A program table writes the Block cell once and leaves it blank down the
 * rest of the block, so a blank carries the label forward — the same rule
 * `toRenderItems` renders subheads by. A row added mid-session with no label
 * is a bottom-added extra: it stands on its own rather than being absorbed
 * into whichever block happened to come last.
 */
export function blockLabels(rows: { group?: string; extra?: boolean }[]): string[] {
	const out: string[] = [];
	let cur = '';
	for (const r of rows) {
		if (r.group) cur = r.group;
		else if (r.extra) cur = '';
		out.push(cur);
	}
	return out;
}

/**
 * Flatten parsed rows into render items: two-a-day session bands, weekly
 * rotation dividers (Week A/B), group subheads, and exercise rows.
 */
export function toRenderItems(rows: SessionRow[]): RowKind[] {
	const items: RowKind[] = [];
	let lastGroup: string | undefined;
	for (const r of rows) {
		const group = r.group ? stripMd(r.group) : '';
		const name = r.name ? stripMd(r.name) : '';

		// Two-a-day session divider (lives in the group column, name empty).
		if (SESSION.test(group) || (SESSION.test(name) && !r.sets && !r.reps)) {
			items.push({ kind: 'session', label: SESSION.test(group) ? group : name });
			lastGroup = undefined;
			continue;
		}
		// A group subhead carried on any row (incl. a Week row like "Power | Week A").
		if (group && group !== lastGroup && !SESSION.test(group)) {
			items.push({ kind: 'group', label: group });
			lastGroup = group;
		}
		// Weekly rotation divider (lives in the exercise column, no prescription).
		if (WEEK.test(name) && !r.sets && !r.reps && !r.rest) {
			items.push({ kind: 'week', label: name });
			continue;
		}
		if (!name) continue; // stray spacer
		items.push({ kind: 'ex', row: r });
	}
	return items;
}
