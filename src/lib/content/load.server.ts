import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Content, Exercise, Program } from './types';
import { buildResolver } from './resolve';
import { parseBlock, parseExercises, parseProgram } from './parse';

/**
 * Collapse same-id entries into a single library atom (FLOWS §1.2 wants
 * zero duplicate ids; the substrate cross-lists a move across sheet groups
 * under one id — see TAXONOMY.md "Dedup"). Same id ⇒ same identity, so we
 * keep the first occurrence and union its link/equipment arrays so nothing
 * is lost. Returns the deduped list plus the ids that were merged (warned,
 * not fatal — the corpus normalizes over time). A genuine collision of two
 * DIFFERENT moves on one slug would show here as a merged id to review.
 */
function dedupeExercises(list: Exercise[]): { exercises: Exercise[]; merged: string[] } {
	const byId = new Map<string, Exercise>();
	const merged = new Set<string>();
	const union = (a?: string[], b?: string[]) =>
		a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined;

	for (const ex of list) {
		const first = byId.get(ex.id);
		if (!first) {
			byId.set(ex.id, { ...ex });
			continue;
		}
		merged.add(ex.id);
		first.urls = union(first.urls, ex.urls);
		first.equipment = union(first.equipment, ex.equipment);
		first.modifiers = union(first.modifiers, ex.modifiers);
	}
	return { exercises: [...byId.values()], merged: [...merged] };
}

// Repo root — content substrate lives alongside the app (default layout 1A).
const ROOT = process.cwd();

function read(rel: string): string {
	return readFileSync(join(ROOT, rel), 'utf-8');
}

function listMarkdown(dir: string): string[] {
	try {
		return readdirSync(join(ROOT, dir))
			.filter((f) => f.endsWith('.md'))
			.map((f) => join(dir, f));
	} catch {
		return [];
	}
}

let cache: Content | null = null;

/**
 * Compile the authored substrate into typed content (FLOWS §1).
 * Runs at build / prerender time. Throws — and thereby fails the build —
 * on the fatal conditions in §1.2. Unresolved names are warnings only.
 */
export function loadContent(): Content {
	if (cache) return cache;

	// Atoms — deduped: cross-listed moves collapse to one identity.
	const { exercises, merged } = dedupeExercises(parseExercises(read('exercises.yaml')));
	const warnings: string[] = [];
	if (merged.length) {
		warnings.push(`Merged ${merged.length} cross-listed exercise id(s): ${merged.join(', ')}`);
	}

	// Molecules
	const blocks = listMarkdown('blocks').map((f) => parseBlock(read(f)));

	// Compositions
	const resolve = buildResolver(exercises, blocks);
	const programFiles = [...listMarkdown('programs'), ...listMarkdown('programs/archive')];
	const programs: Program[] = [];
	const unresolved: Content['unresolved'] = [];
	const badDayFormats: string[] = [];

	for (const file of programFiles) {
		const { program, badDayFormats: bad, unresolved: names } = parseProgram(read(file), resolve);
		if (bad.length) badDayFormats.push(`${file}: ${bad.join(', ')}`);
		// Attribute unresolved names to their day for a useful warnings list.
		for (const day of program.days) {
			for (const row of day.rows) {
				if (row.name && !row.ref) {
					unresolved.push({ name: row.name, program: program.id, day: day.slug });
				}
			}
		}
		if (names.length) {
			warnings.push(
				`${program.id}: ${names.length} unresolved name(s): ${[...new Set(names)].join(', ')}`
			);
		}
		programs.push(program);
	}

	// Fatal: unknown day format
	if (badDayFormats.length) {
		throw new Error(`Unknown day format (weekday code): ${badDayFormats.join(' | ')}`);
	}

	// Fatal: more than one active program
	const active = programs.filter((p) => p.status === 'active');
	if (active.length > 1) {
		throw new Error(
			`More than one program has status: active (${active.map((p) => p.id).join(', ')}). Exactly one allowed.`
		);
	}

	// Order: active first, then archive newest-id first.
	programs.sort((a, b) => {
		if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
		return b.id.localeCompare(a.id);
	});

	cache = { exercises, blocks, programs, warnings, unresolved };
	return cache;
}

export function activeProgram(): Program | undefined {
	return loadContent().programs.find((p) => p.status === 'active');
}

export function programById(id: string): Program | undefined {
	return loadContent().programs.find((p) => p.id === id);
}
