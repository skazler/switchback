import { json } from '@sveltejs/kit';
import { loadContent } from '$lib/content/load.server';
import type { TemplateProgram } from '$lib/templates';

// Every program's day templates — the source for "swap day" (do any template
// day in place of the one scheduled). Prerendered once per build and fetched
// on demand, so day/session pages don't each embed the whole corpus.
export const prerender = true;

export function GET() {
	const templates: TemplateProgram[] = loadContent()
		.programs.filter((p) => p.days.length > 0)
		.map((p) => ({
			id: p.id,
			title: p.title,
			status: p.status,
			progression: p.progression,
			days: p.days
		}));
	return json(templates);
}
