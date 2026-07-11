// Session start + small helpers shared by the day page and the session screen.
import { ulid } from './ulid';
import { putSession, type LocalSession, type PlannedExercise, type LogFormat } from './idb';

interface DayRow {
	group?: string;
	name: string;
	ref?: { id: string } | null;
	sets?: string;
	reps?: string;
	rest?: string;
	notes?: string;
}

/** Local ISO date (YYYY-MM-DD) in the device's timezone. */
export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEK_ROW = /^week\s+(\w+)$/i;
const SESSION_ROW = /^session\s*\d+/i;

/** Infer how a movement is logged from its name + the day label. */
export function inferFormat(name: string, dayLabel = ''): LogFormat {
	const s = `${name} ${dayLabel}`.toLowerCase();
	if (/climb|hangboard|boulder|\bv\d/.test(s)) return 'climb';
	if (/ride|bike|cycl|\bz2\b|zone 2|endurance|tempo|vo2|threshold|\brun\b|jog|hike/.test(s)) return 'ride';
	return 'strength';
}

/** Snapshot the day's prescription into a new local session and persist it.
 *  Week A/B dividers tag the exercises that follow (dropped as rows). */
export async function startSession(programId: string, dayLabel: string, rows: DayRow[]): Promise<string> {
	let week: string | undefined;
	const planned: PlannedExercise[] = [];
	for (const r of rows) {
		if (!r.name) continue;
		const wm = r.name.match(WEEK_ROW);
		if (wm) {
			week = wm[1].toUpperCase();
			continue;
		}
		if (SESSION_ROW.test(r.name)) continue;
		planned.push({
			exercise_id: r.ref?.id ?? '',
			name: r.name,
			group: r.group || undefined,
			sets: r.sets || undefined,
			reps: r.reps || undefined,
			rest: r.rest || undefined,
			notes: r.notes || undefined,
			week,
			format: inferFormat(r.name, dayLabel)
		});
	}
	const session: LocalSession = {
		id: ulid(),
		date: today(),
		program_id: programId,
		day: dayLabel,
		started_at: new Date().toISOString(),
		planned,
		synced: 0
	};
	await putSession(session);
	return session.id;
}
