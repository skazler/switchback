import { loadContent, activeProgram } from '$lib/content/load.server';

// Prerendered library id→name list (for the "add exercise not on the plan"
// picker) plus the active program (so the date field can detect when a
// session's plan doesn't match the day the entered date actually falls on).
export const prerender = true;

export function load() {
	const { exercises } = loadContent();
	return { library: exercises.map((e) => ({ id: e.id, name: e.name })), program: activeProgram() ?? null };
}
