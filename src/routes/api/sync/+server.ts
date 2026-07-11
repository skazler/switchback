import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const prerender = false;

// Owner-only log sync (FLOWS §6). Idempotent upsert by client ULID — safe to
// retry the same batch. 401 for guests; the client keeps its buffer on 401.
interface InSession {
	id: string;
	date: string;
	program_id?: string;
	day?: string;
	started_at?: string;
	completed_at?: string;
	notes?: string;
}
interface InSet {
	id: string;
	session_id: string;
	exercise_id: string;
	performed_instead?: string;
	set_num?: number;
	reps?: number;
	weight?: number;
	unit?: string;
	rpe?: number;
	duration_s?: number;
	notes?: string;
	logged_at: string;
}

const nn = <T>(v: T | undefined | null): T | null => (v === undefined ? null : (v as T));

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!locals.owner) throw error(401, 'Owner session required');
	const db = getDB(platform);
	const { sessions = [], sets = [] } = (await request.json().catch(() => ({}))) as { sessions?: InSession[]; sets?: InSet[] };

	const stmts: D1PreparedStatement[] = [];
	for (const s of sessions) {
		if (!s?.id || !s?.date) continue;
		stmts.push(
			db
				.prepare('INSERT OR REPLACE INTO sessions (id,date,program_id,day,started_at,completed_at,notes) VALUES (?1,?2,?3,?4,?5,?6,?7)')
				.bind(s.id, s.date, nn(s.program_id), nn(s.day), nn(s.started_at), nn(s.completed_at), nn(s.notes))
		);
	}
	for (const x of sets) {
		if (!x?.id || !x?.session_id || !x?.exercise_id) continue;
		stmts.push(
			db
				.prepare('INSERT OR REPLACE INTO sets (id,session_id,exercise_id,performed_instead,set_num,reps,weight,unit,rpe,duration_s,notes,logged_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)')
				.bind(x.id, x.session_id, x.exercise_id, nn(x.performed_instead), nn(x.set_num), nn(x.reps), nn(x.weight), x.unit ?? 'lb', nn(x.rpe), nn(x.duration_s), nn(x.notes), x.logged_at)
		);
	}
	if (stmts.length) await db.batch(stmts);

	return json({ sessions: sessions.map((s) => s.id), sets: sets.map((s) => s.id) });
};
