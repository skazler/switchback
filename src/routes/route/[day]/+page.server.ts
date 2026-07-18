import { error } from '@sveltejs/kit';
import { activeProgram } from '$lib/content/load.server';
import { resolveToday } from '$lib/today';
import type { Program, ProgramDay, SessionRow } from '$lib/content/types';

// Enumerate the active program's days so prerender emits each session page.
export function entries() {
	const program = activeProgram();
	return program ? program.days.map((d) => ({ day: d.slug })) : [];
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

/** Rows that say "see progression" instead of a fixed sets/reps get the
 *  current week's value from the program's progression table substituted in. */
function resolvePlan(day: ProgramDay, program: Program, week: number | null): ProgramDay {
	const progWeek = week != null ? program.progression?.find((p) => p.week === week) : undefined;
	if (!progWeek || !progWeek.columns.length) return day;

	const rows = day.rows.map((row) => {
		if (row.sets || row.reps) return row;
		if (!row.notes || !/progression/i.test(row.notes)) return row;
		const match = matchColumn(row, progWeek.columns);
		if (!match) return row;
		return {
			...row,
			reps: match.value,
			notes: row.notes.replace(/[-–—]?\s*\(?see progression\)?\.?/i, '').trim() || undefined
		};
	});
	return { ...day, rows };
}

export function load({ params }: { params: { day: string } }) {
	const program = activeProgram();
	if (!program) throw error(404, 'No active route');
	const day = program.days.find((d) => d.slug === params.day);
	if (!day) throw error(404, `No session “${params.day}” in the active route`);

	const today = resolveToday(program);
	const week = today.status === 'no-program' ? null : today.week;
	return {
		program: { id: program.id, title: program.title },
		day: resolvePlan(day, program, week),
		week,
		isToday: today.status === 'session' && today.day.slug === day.slug
	};
}
