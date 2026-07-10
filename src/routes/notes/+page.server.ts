import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

// Training notes live in notes.md at the repo root (authored, edit to change).
export function load() {
	const md = readFileSync(join(process.cwd(), 'notes.md'), 'utf-8');
	// Drop the leading H1 — the page renders its own title.
	const body = md.replace(/^#\s+.*\n/, '');
	return { html: marked.parse(body, { async: false }) as string };
}
