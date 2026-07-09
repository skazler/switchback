import { error } from '@sveltejs/kit';
import { activeProgram } from '$lib/content/load.server';
import { resolveToday } from '$lib/today';

export function load() {
	const program = activeProgram();
	if (!program) throw error(404, 'No active route');
	const today = resolveToday(program);
	const week = today.status === 'no-program' ? null : today.week;
	return {
		program,
		currentWeek: week && week > 0 ? week : null,
		open: !program.phases || program.phases.length === 0,
		todaySlug: today.status === 'session' ? today.day.slug : null
	};
}
