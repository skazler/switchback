import { loadContent, activeProgram } from '$lib/content/load.server';

// Prerendered library facets (for the searchable exercise picker — it matches
// on category and body part as well as name) plus the active program (so the
// date field can detect when a session's plan doesn't match the day the
// entered date actually falls on).
export const prerender = true;

export function load() {
	const { exercises } = loadContent();
	return {
		library: exercises.map((e) => ({
			id: e.id,
			name: e.name,
			category: e.category ?? null,
			body: e.body ?? null,
			group: e.group ?? null,
			subgroup: e.subgroup ?? null
		})),
		program: activeProgram() ?? null
	};
}
