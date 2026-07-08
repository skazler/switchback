import { error } from '@sveltejs/kit';
import { loadContent, programById } from '$lib/content/load.server';

export function entries() {
	return loadContent().programs.map((p) => ({ id: p.id }));
}

export function load({ params }: { params: { id: string } }) {
	const program = programById(params.id);
	if (!program) throw error(404, `No program “${params.id}”`);
	return { program };
}
