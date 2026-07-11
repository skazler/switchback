// Session start + small helpers shared by the day page and the session screen.
import { ulid } from './ulid';
import { putSession, type LocalSession, type PlannedExercise } from './idb';

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

/** Snapshot the day's prescription into a new local session and persist it. */
export async function startSession(programId: string, dayLabel: string, rows: DayRow[]): Promise<string> {
	// Skip Week A/B and Session dividers — they're layout, not exercises.
	const isDivider = (n: string) => /^week\s+\w+$/i.test(n) || /^session\s*\d+/i.test(n);
	const planned: PlannedExercise[] = rows
		.filter((r) => r.name && !isDivider(r.name))
		.map((r) => ({
			exercise_id: r.ref?.id ?? '',
			name: r.name,
			group: r.group || undefined,
			sets: r.sets || undefined,
			reps: r.reps || undefined,
			rest: r.rest || undefined,
			notes: r.notes || undefined
		}));
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

/** Rest prescription → seconds. Accepts ":90", "90", "3:00", "1:30". */
export function restSeconds(rest?: string): number {
	if (!rest) return 0;
	const t = rest.trim();
	const m = t.match(/^(\d*):(\d{1,2})$/);
	if (m) return (parseInt(m[1] || '0', 10) || 0) * 60 + parseInt(m[2], 10);
	const n = parseInt(t, 10);
	return Number.isFinite(n) ? n : 0;
}

/** Seconds → "m:ss" (or "0:ss"). */
export function clock(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
