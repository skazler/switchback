import { json } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const prerender = false;

// Session history from D1 (FLOWS §8). Public read of sessions + sets; per-set
// and per-session NOTES are owner-only. Reverse-chron, offset-paginated.
interface SetRow {
	id: string;
	session_id: string;
	exercise_id: string;
	set_num: number | null;
	reps: number | null;
	weight: number | null;
	unit: string | null;
	duration_s: number | null;
	distance: number | null;
	grade: string | null;
	notes?: string | null;
}
interface SessionRow {
	id: string;
	date: string;
	program_id: string | null;
	day: string | null;
	started_at: string | null;
	completed_at: string | null;
	notes?: string | null;
}

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	const db = getDB(platform);
	const owner = locals.owner;
	const limit = Math.min(Number(url.searchParams.get('limit')) || 40, 100);
	const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

	const sCols = `id,date,program_id,day,started_at,completed_at${owner ? ',notes' : ''}`;
	const { results: sessions = [] } = await db
		.prepare(`SELECT ${sCols} FROM sessions ORDER BY date DESC, started_at DESC, id DESC LIMIT ?1 OFFSET ?2`)
		.bind(limit, offset)
		.all<SessionRow>();

	const total = (await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>())?.n ?? 0;

	let sets: SetRow[] = [];
	if (sessions.length) {
		const ph = sessions.map((_, i) => `?${i + 1}`).join(',');
		const cols = `id,session_id,exercise_id,set_num,reps,weight,unit,duration_s,distance,grade${owner ? ',notes' : ''}`;
		const r = await db
			.prepare(`SELECT ${cols} FROM sets WHERE session_id IN (${ph}) ORDER BY set_num`)
			.bind(...sessions.map((s) => s.id))
			.all<SetRow>();
		sets = r.results ?? [];
	}

	const bySession = new Map<string, SetRow[]>();
	for (const s of sets) bySession.set(s.session_id, [...(bySession.get(s.session_id) ?? []), s]);

	return json({
		owner,
		total,
		offset,
		limit,
		sessions: sessions.map((s) => ({ ...s, sets: bySession.get(s.id) ?? [] }))
	});
};
