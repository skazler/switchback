import { loadContent, activeProgram } from '$lib/content/load.server';
import { resolveToday } from '$lib/today';

export function load() {
	const c = loadContent();
	const program = activeProgram();

	// Slim program (no bodies/rows) so the client can recompute "today" against
	// the real current date — a prerendered page would otherwise freeze today at
	// build time. SSR/no-JS still renders the build-time result below.
	const lite = program && {
		...program,
		overviewHtml: '',
		days: program.days.map((d) => ({ ...d, rows: [] }))
	};

	return {
		program: lite ?? null,
		today: resolveToday(program),
		counts: {
			moves: c.exercises.length,
			programs: c.programs.length,
			archived: c.programs.filter((p) => p.status === 'archived').length
		}
	};
}
