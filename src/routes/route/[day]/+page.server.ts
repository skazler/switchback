import { error } from '@sveltejs/kit';
import { activeProgram } from '$lib/content/load.server';
import { resolveToday } from '$lib/today';

// Enumerate the active program's days so prerender emits each session page.
export function entries() {
	const program = activeProgram();
	return program ? program.days.map((d) => ({ day: d.slug })) : [];
}

export function load({ params }: { params: { day: string } }) {
	const program = activeProgram();
	if (!program) throw error(404, 'No active route');
	const day = program.days.find((d) => d.slug === params.day);
	if (!day) throw error(404, `No session “${params.day}” in the active route`);

	// Ship the whole program and the day's SLUG, not a pre-resolved day: the
	// page is prerendered, so week number, the "today" flag and the progression
	// substitution all have to be recomputed client-side or they freeze at build
	// date (same pattern as `/` and `/route`). What's returned here is only the
	// build-time fallback the prerendered HTML shows before hydration.
	const today = resolveToday(program);
	const week = today.status === 'no-program' ? null : today.week;
	return {
		program,
		slug: day.slug,
		week,
		isToday: today.status === 'session' && today.day.slug === day.slug
	};
}
