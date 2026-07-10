// xlsx → program markdown converter.
//
// Source spreadsheets come in three shapes:
//  1. weekly split  — one sheet per training day, named with a weekday
//     prefix ("M upper acc", "Th RunUpper^"). → schedule: weekly.
//  2. rotation split — session sheets named by slot, not weekday
//     ("Legs 1", "upper A"). → schedule: rotation (no today-binding).
//  3. calendar/reference — no SETS/REPS sessions (running matrices).
//     → rendered as reference tables in the body, no day sections.
//
// Session sheets have a SETS/REPS/REST/NOTES header; columns are located
// relative to SETS (so 5-col "[exercise, sets…]" and 6-col
// "[group, exercise, sets…]" both work). Rest is an Excel time serial, so
// we read formatted text (raw:false) to recover "3:00" / ":90".
//
// Usage:
//   node scripts/import-xlsx.mjs manifest              # batch import
//   node scripts/import-xlsx.mjs <file.xlsx> --id <id> --title "…" [flags]

import XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const DL = `${process.env.HOME}/Downloads/drive-download-20260709T021751Z-3-001`;

const WEEKDAYS = new Set(['su', 'm', 'mon', 't', 'tu', 'tue', 'w', 'wed', 'th', 'thu', 'f', 'fri', 'sa', 'sat']);

const rowsOf = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: false });
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const esc = (v) => clean(v).replace(/\|/g, '\\|');

/** Weekday day sheet name "Th RunUpper^" → { code, label }, else null. */
function weekdayName(name) {
	const [code, ...rest] = clean(name).split(' ');
	if (!WEEKDAYS.has(code.toLowerCase())) return null;
	const label = rest.join(' ').replace(/[\s_^*-]+$/, '').trim();
	return { code, label: label || code };
}

/** Locate the SETS/REPS header row and derive column indices around it. */
function sessionLayout(rows) {
	const hi = rows.findIndex((r) => {
		const c = r.map((x) => clean(x).toLowerCase());
		return c.includes('sets') && c.includes('reps');
	});
	if (hi === -1) return null;
	const H = rows[hi].map((x) => clean(x).toLowerCase());
	const iSets = H.indexOf('sets');
	return {
		body: rows.slice(hi + 1),
		iGroup: iSets - 2 >= 0 ? iSets - 2 : -1,
		iExercise: iSets - 1,
		iSets,
		iReps: H.indexOf('reps'),
		iRest: H.indexOf('rest'),
		iNotes: H.indexOf('notes')
	};
}

function sessionTable(rows) {
	const L = sessionLayout(rows);
	if (!L) return null;
	const out = ['| Block | Exercise | Sets | Reps | Rest | Notes |', '|---|---|---|---|---|---|'];
	let n = 0;
	for (const r of L.body) {
		const at = (i) => (i >= 0 ? esc(r[i]) : '');
		const cols = [at(L.iGroup), at(L.iExercise), at(L.iSets), at(L.iReps), at(L.iRest), at(L.iNotes)];
		if (cols.every((x) => !x)) continue;
		out.push(`| ${cols.join(' | ')} |`);
		n++;
	}
	return n ? out.join('\n') : null;
}

/** Render an arbitrary sheet as a markdown table (reference/calendar). */
function referenceTable(rows) {
	const width = Math.max(...rows.map((r) => r.length), 0);
	if (!width) return null;
	const line = (cells) => '| ' + Array.from({ length: width }, (_, i) => esc(cells[i]) || ' ').join(' | ') + ' |';
	const out = [line(rows[0]), '|' + ' --- |'.repeat(width)];
	for (const r of rows.slice(1)) if (r.some((c) => clean(c))) out.push(line(r));
	return out.join('\n');
}

// Dead cross-sheet references (the old Google-Sheets links). The exercise
// compilation is now the library, notes on training is /notes, and the AAR /
// CPAT sheets are gone — drop these rows from the overview entirely.
const DEAD_REF = /^(references|aar|cpat events|exercise compilation|notes on training|running)$/i;
const isDeadRef = (cells) => cells.some((c) => DEAD_REF.test(clean(c)));

function overviewMd(ws) {
	if (!ws) return '';
	const rows = rowsOf(ws);
	const lines = [];
	const gridStart = rows.findIndex((r) => r.map(clean).includes('Monday'));
	for (let i = 0; i < rows.length; i++) {
		if (i === gridStart) {
			const header = rows[i].map(clean);
			const w = header.length;
			lines.push('| ' + header.map((h) => h || ' ').join(' | ') + ' |', '|' + ' --- |'.repeat(w));
			for (let j = i + 1; j < rows.length; j++) {
				const cells = rows[j].map(clean);
				if (cells.every((x) => !x)) break;
				i = j;
				if (isDeadRef(cells)) continue;
				while (cells.length < w) cells.push('');
				lines.push('| ' + cells.slice(0, w).map((x) => x || ' ').join(' | ') + ' |');
			}
			continue;
		}
		const cells = rows[i].map(clean);
		if (cells.every((x) => !x) || isDeadRef(cells)) continue;
		const label = cells[0];
		const value = cells.slice(1).filter(Boolean).join(' — ');
		if (i === 0 && /^".*"$/.test(label)) lines.push(`> ${label}`, '');
		else if (label && value) lines.push(`**${label.replace(/:$/, '')}** — ${value}`, '');
		else if (label) lines.push(`**${label.replace(/:$/, '')}**`, '');
		else if (value) lines.push(`- ${value}`);
	}
	return lines.join('\n').trim();
}

export function convert(file, meta) {
	const wb = XLSX.readFile(file);

	// Classify sheets: weekday session, non-weekday session, or reference.
	const sessions = [];
	const references = [];
	for (const name of wb.SheetNames) {
		if (name === 'Overview') continue;
		const rows = rowsOf(wb.Sheets[name]);
		const table = sessionTable(rows);
		if (table) sessions.push({ name, wd: weekdayName(name), table });
		else references.push({ name, rows });
	}
	const rotation = sessions.length > 0 && sessions.some((s) => !s.wd);
	const schedule = rotation ? 'rotation' : 'weekly';

	const fm = ['---', `id: ${meta.id}`, `title: ${JSON.stringify(meta.title)}`, `status: ${meta.status ?? 'archived'}`];
	if (meta.purpose) fm.push(`purpose: ${JSON.stringify(meta.purpose)}`);
	if (meta.level) fm.push(`level: ${meta.level}`);
	if (meta.series) fm.push(`series: ${meta.series}`);
	if (sessions.length && rotation) fm.push('schedule: rotation');
	if (meta.start) fm.push(`start: ${meta.start}`);
	fm.push(`source: ${basename(file)}`, '---', '');

	const parts = [fm.join('\n'), `# ${meta.title}`, ''];
	const ov = overviewMd(wb.Sheets['Overview']);
	if (ov) parts.push(ov, '');

	for (const s of sessions) {
		const label = s.wd ? s.wd.label : clean(s.name).replace(/[\s_^*-]+$/, '');
		const code = s.wd ? s.wd.code : 'rot';
		parts.push(`## ${label}  <!-- ${code} ${label} -->`, '', s.table, '');
	}

	// No sessions → a calendar/reference plan: render its sheets as tables.
	if (sessions.length === 0) {
		for (const r of references) {
			const tbl = referenceTable(r.rows);
			if (tbl) parts.push(`### ${clean(r.name)}`, '', tbl, '');
		}
	}

	const md = parts.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
	return { md, dayCount: sessions.length, schedule };
}

// Latest version of each lineage NOT already in the repo. Per the agreed
// versioning model (A), earlier _vN versions live in git history.
export const MANIFEST = [
	{ file: '26q1_v2.xlsx', id: '2026-q1', title: '2026 Q1 — Base', purpose: 'Conditioning base', level: 'base', series: 'quarterly-base' },
	{ file: '26r2r.xlsx', id: '2026-r2r', title: '2026 — Return to Running', purpose: 'Running base', level: 'base', series: 'r2r' },
	{ file: '2xPPL+conditioning (for climax work schedule).xlsx', id: 'ppl-conditioning', title: '2×PPL + Conditioning', purpose: 'Hypertrophy + conditioning', level: 'build', series: 'ppl-conditioning' },
	{ file: '2xPPL+rehab_V2.xlsx', id: 'ppl-rehab', title: '2×PPL + Rehab', purpose: 'Hypertrophy + rehab', level: 'base', series: 'ppl-rehab' },
	{ file: '2xPPL+run.xlsx', id: 'ppl-run', title: '2×PPL + Run', purpose: 'Hypertrophy + running', level: 'build', series: 'ppl-run' },
	{ file: '4-day bro splits + rehab.xlsx', id: 'bro-split-rehab', title: '4-Day Bro Split + Rehab', purpose: 'Hypertrophy', level: 'base', series: 'bro-split' },
	{ file: 'Base+CPAT.xlsx', id: 'base-cpat', title: 'Base + CPAT', purpose: 'Firefighter CPAT prep', level: 'base', series: 'cpat' },
	{ file: 'Base+SBSeason_v3.xlsx', id: 'base-sb-season', title: 'Base — Snowboard Season', purpose: 'Snowboard prep', level: 'build', series: 'sb-season' },
	{ file: 'Firecamp Mod.xlsx', id: 'firecamp-mod', title: 'Firecamp Mod', purpose: 'Firefighter conditioning', level: 'peak', series: 'firecamp' },
	{ file: 'H&FFC_v5.xlsx', id: 'hffc', title: 'Hypertrophy & Firefighter Conditioning', purpose: 'Hypertrophy + firefighter conditioning', level: 'build', series: 'hffc' },
	{ file: 'In-Season-Fire-Academy.xlsx', id: 'fire-academy', title: 'In-Season Fire Academy', purpose: 'Firefighter academy', level: 'peak', series: 'fire-academy' },
	{ file: 'Run+Strength.xlsx', id: 'run-strength', title: 'Run + Strength', purpose: 'Running + strength', level: 'base', series: 'run-strength' },
	{ file: 'baseline.xlsx', id: 'baseline', title: 'Baseline', purpose: 'General baseline', level: 'base', series: 'baseline' }
];

// ── CLI ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
	const a = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
		else a._.push(argv[i]);
	}
	return a;
}

const args = parseArgs(process.argv.slice(2));
function emit(file, meta) {
	const out = meta.out ?? `programs/archive/${meta.id}.md`;
	const { md, dayCount, schedule } = convert(file, meta);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, md);
	console.log(`wrote ${out.padEnd(40)} ${String(dayCount).padStart(2)} days · ${schedule}`);
}

if (args._[0] === 'manifest') {
	for (const m of MANIFEST) emit(`${DL}/${m.file}`, { ...m, status: 'archived' });
} else if (args._[0]) {
	const file = args._[0].includes('/') ? args._[0] : `${DL}/${args._[0]}`;
	emit(file, { id: args.id, title: args.title, status: args.status, purpose: args.purpose, level: args.level, series: args.series, start: args.start, out: args.out });
}
