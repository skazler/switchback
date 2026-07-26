// Calendar dates for a weekly program. Nothing here is authored: every date
// is derived from the program's `start` (a Monday) + the week index, so the
// whole dated view prerenders. Whole-day math in UTC — see today.ts.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY_MS = 86_400_000;

/** ISO day string → midnight-UTC epoch. */
function epoch(iso: string): number {
	const [y, m, d] = iso.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

function iso(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** ISO day `n` days after `start`. */
export function addDays(start: string, n: number): string {
	return iso(epoch(start) + n * DAY_MS);
}

/** The Monday that opens week `week` (1-based) of a program starting `start`. */
export function weekStart(start: string, week: number): string {
	return addDays(start, (week - 1) * 7);
}

/**
 * The date a given weekday falls on in a given week.
 * `weekday` is a JS getDay() index (Sun=0 … Sat=6); weeks run Mon → Sun.
 */
export function dateForWeekday(start: string, week: number, weekday: number): string {
	return addDays(weekStart(start, week), (weekday + 6) % 7);
}

/** "14 SEP" */
export function formatDay(isoDay: string): string {
	const [, m, d] = isoDay.split('-').map(Number);
	return `${d} ${MONTHS[m - 1]}`;
}

/** "Mon 14 SEP" */
export function formatDayWithWeekday(isoDay: string): string {
	const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return `${names[new Date(epoch(isoDay)).getUTCDay()]} ${formatDay(isoDay)}`;
}

/** Mon–Sun span of a week: "14–20 SEP", or "28 SEP – 4 OCT" across a month. */
export function formatWeekRange(start: string, week: number): string {
	const from = weekStart(start, week);
	const to = addDays(from, 6);
	const [, fm, fd] = from.split('-').map(Number);
	const [, tm, td] = to.split('-').map(Number);
	return fm === tm
		? `${fd}–${td} ${MONTHS[fm - 1]}`
		: `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]}`;
}
