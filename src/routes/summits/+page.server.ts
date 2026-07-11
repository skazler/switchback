import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

interface Goal {
	id?: string;
	exercise?: string; // lift PR goal
	target?: number;
	unit?: string;
	summit?: string; // objective / event goal
	detail?: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Goals ("unclimbed" summits) are authored in the repo (goals.yaml) — the
// documents door (FLOWS §8). Achieved PRs come from D1 in M4.
export function load() {
	let goals: (Goal & { id: string })[] = [];
	try {
		const doc = parse(readFileSync(join(process.cwd(), 'goals.yaml'), 'utf-8'));
		const list = Array.isArray(doc?.goals) ? doc.goals : Array.isArray(doc) ? doc : [];
		goals = list
			.filter((g: Goal) => g && (g.summit || (g.exercise && g.target != null)))
			.map((g: Goal) => ({ ...g, id: g.id ?? slug(g.summit ?? g.exercise ?? '') }));
	} catch {
		/* no goals.yaml authored yet */
	}
	return { goals };
}
