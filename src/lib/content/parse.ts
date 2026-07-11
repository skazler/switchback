import matter from 'gray-matter';
import { marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import type { Block, Exercise, Program, ProgramDay, SessionRow } from './types';
import { buildResolver, dayMarker, intensityFor } from './resolve';

marked.setOptions({ gfm: true });

/** Weekday code (as authored) → JS getDay() index (Sun=0 … Sat=6). */
export const WEEKDAY: Record<string, number> = {
	su: 0, sun: 0,
	m: 1, mon: 1,
	t: 2, tu: 2, tue: 2,
	w: 3, wed: 3,
	th: 4, thu: 4,
	f: 5, fri: 5,
	sa: 6, sat: 6
};

/** YAML auto-parses `2025-12-29` into a Date; normalize back to an ISO day. */
function isoDate(v: unknown): string | undefined {
	if (v == null) return undefined;
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	return String(v);
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

// ── exercises.yaml ──────────────────────────────────────────────────
export function parseExercises(yamlText: string): Exercise[] {
	const doc = parseYaml(yamlText) as { exercises?: Exercise[] };
	return doc?.exercises ?? [];
}

// ── blocks/*.md ─────────────────────────────────────────────────────
export function parseBlock(fileText: string): Block {
	const { data, content } = matter(fileText);
	return {
		id: String(data.id ?? ''),
		title: String(data.title ?? data.id ?? ''),
		type: data.type ? String(data.type) : undefined,
		appearsAs: data['appears-as'] ? String(data['appears-as']) : undefined,
		rule: data.rule ? String(data.rule) : undefined,
		bodyHtml: marked.parse(content, { async: false }) as string
	};
}

// ── programs/*.md ───────────────────────────────────────────────────

/** Comment embedded in a day heading, e.g. `<!-- Th athletic enh -->`. */
const DAY_COMMENT = /<!--\s*(.+?)\s*-->/;

// Slot-in programs referenced by name in other programs' overviews → link them
// to their own page. Skips the referenced program's own overview.
const SLOT_INS: { re: RegExp; id: string }[] = [
	{ re: /\b(fireground(?:\s+simulation)?\s+circuit)\b/gi, id: 'fireground-circuit' }
];
function linkSlotIns(html: string, selfId: string): string {
	for (const { re, id } of SLOT_INS) {
		if (id === selfId) continue;
		html = html.replace(re, `<a href="/routes/${id}">$1</a>`);
	}
	return html;
}

interface DayHeading {
	code: string;
	label: string;
	valid: boolean;
}

/** Parse a `## heading  <!-- code label -->` raw line. `rot` is the
 *  rotation-day sentinel (valid only when the program is schedule: rotation). */
function parseDayHeading(raw: string, rotation: boolean): DayHeading | null {
	const m = raw.match(DAY_COMMENT);
	if (!m) return null;
	const inner = m[1].trim(); // "Th athletic enh" | "rot Legs 1"
	const [code, ...rest] = inner.split(/\s+/);
	const isWeekday = code.toLowerCase() in WEEKDAY;
	return {
		code,
		label: rest.join(' ') || inner,
		valid: isWeekday || (rotation && code.toLowerCase() === 'rot')
	};
}

interface ParseProgramResult {
	program: Program;
	/** day-heading codes that were present but not a known weekday */
	badDayFormats: string[];
	/** table names that resolved to nothing */
	unresolved: string[];
}

export function parseProgram(
	fileText: string,
	resolve: ReturnType<typeof buildResolver>
): ParseProgramResult {
	const { data, content } = matter(fileText);
	const tokens = marked.lexer(content);
	const rotation = data.schedule === 'rotation';

	const overviewTokens: typeof tokens = [] as never;
	const days: ProgramDay[] = [];
	const badDayFormats: string[] = [];
	const unresolved: string[] = [];
	const usedSlugs = new Set<string>();

	let current: { heading: DayHeading; tokens: typeof tokens } | null = null;

	const flush = () => {
		if (!current) return;
		const { heading, tokens: dayTokens } = current;
		const table = dayTokens.find((t) => t.type === 'table') as
			| { header: { text: string }[]; rows: { text: string }[][] }
			| undefined;
		const rows = table ? tableToRows(table, resolve, unresolved) : [];

		let slug = slugify(`${heading.code} ${heading.label}`);
		let n = 2;
		while (usedSlugs.has(slug)) slug = `${slugify(`${heading.code} ${heading.label}`)}-${n++}`;
		usedSlugs.add(slug);

		days.push({
			slug,
			code: heading.code,
			weekday: WEEKDAY[heading.code.toLowerCase()] ?? -1,
			label: heading.label,
			rows,
			marker: dayMarker(rows.map((r) => r.marker).filter(Boolean) as never)
		});
		current = null;
	};

	for (const token of tokens) {
		if (token.type === 'heading' && (token as { depth: number }).depth === 2) {
			flush();
			const heading = parseDayHeading((token as { raw: string }).raw, rotation);
			if (heading) {
				if (!heading.valid) badDayFormats.push(heading.code);
				current = { heading, tokens: [] as never };
			} else {
				// A depth-2 heading without a day comment — treat as overview prose.
				overviewTokens.push(token);
			}
			continue;
		}
		if (current) current.tokens.push(token);
		else overviewTokens.push(token);
	}
	flush();

	// Drop a leading H1 — it's the program title, which the page renders itself.
	while (overviewTokens.length && (overviewTokens[0] as { type: string }).type === 'space') overviewTokens.shift();
	const first = overviewTokens[0] as { type: string; depth?: number } | undefined;
	if (first?.type === 'heading' && first.depth === 1) overviewTokens.shift();

	const program: Program = {
		id: String(data.id ?? ''),
		title: String(data.title ?? data.id ?? ''),
		status: data.status === 'active' ? 'active' : 'archived',
		schedule: rotation ? 'rotation' : 'weekly',
		purpose: data.purpose ? String(data.purpose) : undefined,
		level: data.level ? String(data.level) : undefined,
		series: data.series ? String(data.series) : undefined,
		start: isoDate(data.start),
		source: data.source ? String(data.source) : undefined,
		phases: Array.isArray(data.phases) ? data.phases : undefined,
		overviewHtml: linkSlotIns(marked.parser(overviewTokens as never) as string, String(data.id ?? '')),
		days
	};

	return { program, badDayFormats, unresolved };
}

function tableToRows(
	table: { header: { text: string }[]; rows: { text: string }[][] },
	resolve: ReturnType<typeof buildResolver>,
	unresolved: string[]
): SessionRow[] {
	const headers = table.header.map((h) => h.text.trim().toLowerCase());
	const col = (name: string, fallback: number) => {
		const i = headers.indexOf(name);
		return i === -1 ? fallback : i;
	};
	const iGroup = col('block', 0);
	const iName = col('exercise', 1);
	const iSets = col('sets', 2);
	const iReps = col('reps', 3);
	const iRest = col('rest', 4);
	const iNotes = col('notes', 5);

	const rows: SessionRow[] = [];
	for (const cells of table.rows) {
		const get = (i: number) => (i < cells.length ? cells[i].text.trim() : '');
		const name = get(iName);
		const group = get(iGroup);
		if (!name && !group) continue; // spacer row

		const ref = name ? resolve(name) : null;
		if (name && !ref) unresolved.push(name);

		const reps = get(iReps);
		rows.push({
			group: group || undefined,
			name,
			ref,
			sets: get(iSets) || undefined,
			reps: reps || undefined,
			rest: get(iRest) || undefined,
			notes: get(iNotes) || undefined,
			marker: name ? intensityFor({ group, name, reps }) : undefined
		});
	}
	return rows;
}
