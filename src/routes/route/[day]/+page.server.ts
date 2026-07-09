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

	const today = resolveToday(program);
	return {
		program: { id: program.id, title: program.title },
		day,
		week: today.status === 'no-program' ? null : today.week,
		isToday: today.status === 'session' && today.day.slug === day.slug
	};
}
