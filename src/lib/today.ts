import type { Phase, Program, ProgramDay, SessionRow } from './content/types';
import { site } from './site.config';

export type TodayResult =
	| { status: 'no-program' }
	| { status: 'before-start'; week: 0; startsOn: string }
	| { status: 'rest'; week: number; phase?: Phase }
	| { status: 'session'; week: number; phase?: Phase; day: ProgramDay };

/** Calendar-date parts in the site timezone (America/Chicago). */
function zonedYmd(now: Date): { y: number; m: number; d: number } {
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: site.timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const [y, m, d] = fmt.format(now).split('-').map(Number);
	return { y, m, d };
}

/** Midnight-UTC epoch for a calendar date — safe for whole-day math. */
function dayEpoch(y: number, m: number, d: number): number {
	return Date.UTC(y, m - 1, d);
}

export function phaseForWeek(program: Program, week: number): Phase | undefined {
	return program.phases?.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);
}

/**
 * Resolve "today" against a program (FLOWS §3).
 * week = floor((today - start) / 7) + 1, evaluated in America/Chicago.
 * Day = program day whose weekday matches today; none → rest.
 */
export function resolveToday(
	program: Program | undefined,
	now: Date = new Date()
): TodayResult {
	if (!program) return { status: 'no-program' };

	const { y, m, d } = zonedYmd(now);
	const todayEpoch = dayEpoch(y, m, d);
	const weekday = new Date(todayEpoch).getUTCDay(); // Sun=0 … Sat=6

	let week = 1;
	if (program.start) {
		const [sy, sm, sd] = program.start.split('-').map(Number);
		const startEpoch = dayEpoch(sy, sm, sd);
		const diffDays = Math.round((todayEpoch - startEpoch) / 86_400_000);
		if (diffDays < 0) {
			return { status: 'before-start', week: 0, startsOn: program.start };
		}
		week = Math.floor(diffDays / 7) + 1;
	}

	const phase = phaseForWeek(program, week);
	const day = program.days.find((dd) => dd.weekday === weekday);
	if (!day) return { status: 'rest', week, phase };
	return { status: 'session', week, phase, day };
}

const WEEKDAY_NAMES = [
	'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

/** A progression column named for this sheet's weekday — e.g. a "Sunday"
 *  column read by the Sunday sheet. Unambiguous by construction, so it wins
 *  over the word-overlap guess below. */
function columnForWeekday(day: ProgramDay, columns: { label: string; value: string }[]) {
	const name = WEEKDAY_NAMES[day.weekday];
	if (!name) return undefined;
	return columns.find((c) => c.label.trim().toLowerCase() === name);
}

/** Best-matching progression column for a row, by word overlap between the
 *  column's header and the row's own name + notes. No overlap → no guess. */
function matchColumn(row: SessionRow, columns: { label: string; value: string }[]) {
	const words = `${row.name} ${row.notes ?? ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
	let best: { label: string; value: string } | undefined;
	let bestScore = 0;
	for (const c of columns) {
		const colWords = c.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
		const score = colWords.filter((w) => words.includes(w)).length;
		if (score > bestScore) {
			bestScore = score;
			best = c;
		}
	}
	return best;
}

/** A dash in a progression cell means "nothing this week" — the sheet keeps
 *  its own prescription rather than printing a lone em dash as one. */
function isPlaceholder(value: string): boolean {
	return !value.replace(/[-–—\s]/g, '');
}

/** Rows that say "see progression" instead of a fixed sets/reps get the
 *  current week's value from the program's progression table substituted in. */
export function resolvePlan(day: ProgramDay, program: Program, week: number | null): ProgramDay {
	const progWeek = week != null ? program.progression?.find((p) => p.week === week) : undefined;
	if (!progWeek || !progWeek.columns.length) return day;

	const rows = day.rows.map((row) => {
		if (row.sets || row.reps) return row;
		if (!row.notes || !/progression/i.test(row.notes)) return row;
		const match = columnForWeekday(day, progWeek.columns) ?? matchColumn(row, progWeek.columns);
		if (!match || isPlaceholder(match.value)) return row;
		return {
			...row,
			reps: match.value,
			notes: row.notes.replace(/[-–—]?\s*\(?see progression\)?\.?/i, '').trim() || undefined
		};
	});
	return { ...day, rows };
}
