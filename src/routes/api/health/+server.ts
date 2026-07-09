import { json } from '@sveltejs/kit';
import { loadContent } from '$lib/content/load.server';

// Per-deploy build health (FLOWS §1). Prerendered — a static snapshot of the
// compile. Exposes the unresolved-name warnings the pipeline collected.
export const prerender = true;

export function GET() {
	const c = loadContent();
	return json({
		status: 'ok',
		counts: {
			exercises: c.exercises.length,
			blocks: c.blocks.length,
			programs: c.programs.length
		},
		warnings: c.warnings,
		unresolved: {
			count: c.unresolved.length,
			names: [...new Set(c.unresolved.map((u) => u.name))].sort((a, b) => a.localeCompare(b))
		}
	});
}
