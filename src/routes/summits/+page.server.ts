import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

interface Goal {
	exercise: string;
	target: number;
	unit?: string;
}

// Goals ("unclimbed" summits) are authored in the repo (goals.yaml) — the
// documents door (FLOWS §8). Achieved PRs come from D1 in M4.
export function load() {
	let goals: Goal[] = [];
	try {
		const doc = parse(readFileSync(join(process.cwd(), 'goals.yaml'), 'utf-8'));
		const list = Array.isArray(doc?.goals) ? doc.goals : Array.isArray(doc) ? doc : [];
		goals = list.filter((g: Goal) => g && g.exercise && g.target != null);
	} catch {
		/* no goals.yaml authored yet */
	}
	return { goals };
}
