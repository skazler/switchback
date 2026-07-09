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

/** Best library query for a choice cell: the most specific non-generic word. */
export function choiceHref(row: SessionRow): string {
	const stop = new Set([
		'choice', 'exercise', 'exercises', 'movement', 'work', 'the', 'a', 'of', 'and', 'focus', 'optional'
	]);
	const words = displayName(row.name)
		.toLowerCase()
		.replace(/[*()/&]/g, ' ')
		.split(/\s+/)
		.filter((w) => w && /^[a-z]/.test(w) && !stop.has(w));
	const term = words[0] ?? (row.group ? stripMd(row.group).toLowerCase().split(/\s+/)[0] : '');
	return term ? `/library?q=${encodeURIComponent(term)}` : '/library';
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
