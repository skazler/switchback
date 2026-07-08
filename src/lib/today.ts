import type { Phase, Program, ProgramDay } from './content/types';
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
