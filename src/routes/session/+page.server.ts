import { loadContent } from '$lib/content/load.server';

// Prerendered library id→name list so the session screen can offer an
// "add exercise not on the plan" picker without a runtime lookup.
export const prerender = true;

export function load() {
	const { exercises } = loadContent();
	return { library: exercises.map((e) => ({ id: e.id, name: e.name })) };
}
