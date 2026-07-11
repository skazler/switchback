import { loadContent } from '$lib/content/load.server';

// Prerendered: bake the exercise id → name map so the client can label the
// D1 log (which returns ids only) without a runtime library lookup.
export const prerender = true;

export function load() {
	const { exercises } = loadContent();
	const names: Record<string, string> = {};
	for (const e of exercises) names[e.id] = e.name;
	return { names };
}
