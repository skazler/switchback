import { loadContent } from '$lib/content/load.server';

export function load() {
	const c = loadContent();
	return {
		programs: c.programs.map((p) => ({
			id: p.id,
			title: p.title,
			status: p.status,
			days: p.days.length,
			source: p.source ?? null
		}))
	};
}
