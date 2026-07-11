// Historical training-log importer.
//
// sources/Log.xlsx holds three sheets of hand-kept records:
//   • hypertrophy&strength      (2020→)  tidy triple-column
//   • athleticism&conditioning  (2025→)  tidy triple-column
//   • snowboard                          session/trick blocks — NOT handled here
//
// The two tidy sheets share a layout: col 0 Date (merged down a session's
// rows), col 1 Feel, then category groups of THREE columns — {name, measure,
// record} — one group per workout type (Arms / Back / … or Anaerobic / Core /
// …), with a spacer column between groups, and a trailing Notes column.
// "measure" is the load (e.g. 20lbs), "record" is sets×reps (e.g. 8x3).
//
// Emits:
//   log/history/<sheet>.csv   tidy: date,category,exercise,exercise_id,measure,record,feel,notes
//   log/history/seed.sql      D1 seed — sessions (one per sheet+date) + sets
//                             (one per entry; raw "measure/record" kept in the
//                             set's notes, reps/weight parsed best-effort).
//
// Usage:  node scripts/import-log-history.mjs

import XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'sources/Log.xlsx';
const OUT = 'log/history';

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const slugify = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const csvCell = (v) => {
	const s = clean(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const sqlStr = (v) => {
	const s = clean(v);
	return s ? `'${s.replace(/'/g, "''")}'` : 'NULL';
};

// ── exercise-library resolver (name → exercises.yaml id) ────────────────
function loadExerciseIds() {
	const byName = new Map();
	const ids = new Set();
	let name = null;
	for (const line of readFileSync('exercises.yaml', 'utf8').split('\n')) {
		const n = line.match(/^\s*-?\s*name:\s*"?(.+?)"?\s*$/);
		if (n) name = clean(n[1]);
		const i = line.match(/^\s*id:\s*(\S+)\s*$/);
		if (i) {
			ids.add(i[1]);
			if (name) byName.set(name.toLowerCase(), i[1]);
		}
	}
	return { byName, ids };
}
const LIB = loadExerciseIds();
const resolveId = (name) => {
	const n = clean(name);
	if (!n) return '';
	return LIB.byName.get(n.toLowerCase()) ?? (LIB.ids.has(slugify(n)) ? slugify(n) : '');
};

// ── parsers ─────────────────────────────────────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const mo = (s) => MONTHS[s.slice(0, 3).toLowerCase()];
function parseDate(v) {
	// tidy sheets: "2020 May 24"
	const m = clean(v).match(/^(\d{4})\s+([A-Za-z]+)\s+(\d{1,2})$/);
	if (!m || !mo(m[2])) return null;
	return `${m[1]}-${String(mo(m[2])).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}
function parseSbDate(v) {
	// snowboard sheet: "20 Oct 2025"
	const m = clean(v).match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
	if (!m || !mo(m[2])) return null;
	return `${m[3]}-${String(mo(m[2])).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
const toSec = (v, u) => (/^hr/i.test(u) ? v * 3600 : /^min/i.test(u) ? v * 60 : v);

// A record is a per-set list. Split on commas; each segment is one or more
// sets. `NxM` = N sets of M reps (run-length); standalone `M` = one set of M
// reps; `s/min/hr` → duration; `NLxM` → N sets at level M; etc. For a lone
// `NxM` reps are the larger number (both notations exist; see git history).
// Returns a flat array of per-set { reps? | duration_s?, note? }.
function expandRecord(rec, bareIsSets = false) {
	const out = [];
	for (const seg of clean(rec).split(',').map((s) => s.trim()).filter(Boolean)) {
		let m;
		if ((m = seg.match(/^(\d+)\s*[x×]\s*(\d+)\s*(s|sec|secs|min|mins|hr|hrs)\*?$/i))) {
			for (let k = 0; k < +m[1]; k++) out.push({ duration_s: toSec(+m[2], m[3]) }); // Nx Ms/min
		} else if ((m = seg.match(/^(\d+)\s*[lL]\s*[x×]\s*(\d+)\*?$/))) {
			for (let k = 0; k < +m[2]; k++) out.push({ note: `level ${m[1]}` }); // NLxM → M sets @ level N
		} else if ((m = seg.match(/^(\d+)\s*[x×]\s*(\d+)\*?$/))) {
			const sets = Math.min(+m[1], +m[2]);
			const reps = Math.max(+m[1], +m[2]);
			for (let k = 0; k < sets; k++) out.push({ reps }); // NxM reps
		} else if ((m = seg.match(/^(\d+)\s*(s|sec|secs|min|mins|hr|hrs)\*?$/i))) {
			out.push({ duration_s: toSec(+m[1], m[2]) }); // standalone duration
		} else if ((m = seg.match(/^(\d+)\s*laps?\*?$/i))) {
			out.push({ note: `${m[1]} laps` });
		} else if ((m = seg.match(/^(\d+)\s*(each|repeats?)\*?$/i))) {
			out.push({ reps: +m[1], note: /each/i.test(m[2]) ? 'each side' : undefined });
		} else if ((m = seg.match(/^(\d+)\*?$/))) {
			if (bareIsSets) for (let k = 0; k < +m[1]; k++) out.push({}); // sled: N sets, load unknown
			else out.push({ reps: +m[1] }); // one set of N reps
		} else {
			out.push({ note: seg }); // week/day refs, freeform — keep, no numbers
		}
	}
	return out;
}
function parseWeight(meas) {
	const m = clean(meas).match(/(-?\d+(?:\.\d+)?)\s*lb/i);
	return m ? +m[1] : null;
}

// Category-group columns from the header row: each label sits at a group's
// `name` column; measure/record follow. Notes is the trailing labeled column.
function groupCols(header) {
	const groups = [];
	for (let i = 2; i < header.length; i++) {
		const label = clean(header[i]);
		if (label && !/^notes$/i.test(label)) groups.push({ label, iName: i, iMeasure: i + 1, iRecord: i + 2 });
	}
	return { groups, iNotes: header.findIndex((h) => /^notes$/i.test(clean(h))) };
}

// ── run ─────────────────────────────────────────────────────────────────
const wb = XLSX.readFile(SRC);
mkdirSync(OUT, { recursive: true });

const sqlSessions = [];
const sqlSets = [];
let seq = 0;
const nextId = (p) => `${p}${String(++seq).padStart(5, '0')}`;

for (const sheet of ['hypertrophy&strength', 'athleticism&conditioning']) {
	const ws = wb.Sheets[sheet];
	if (!ws) continue;
	const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: false });
	const { groups, iNotes } = groupCols(rows[0]);
	const slug = slugify(sheet);

	const out = [['date', 'category', 'exercise', 'exercise_id', 'measure', 'record', 'feel', 'notes']];
	const sessionId = new Map(); // date → session id (one session per sheet+date)
	let date = null;
	let entries = 0;

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		const d = parseDate(row[0]);
		if (d) date = d; // forward-fill across a session's rows
		if (!date) continue;
		const feel = clean(row[1]);
		const notes = iNotes >= 0 ? clean(row[iNotes]) : '';

		for (const g of groups) {
			const name = clean(row[g.iName]);
			const measure = clean(row[g.iMeasure]);
			const record = clean(row[g.iRecord]);
			if (!name && !measure && !record) continue;

			const exId = resolveId(name);
			out.push([date, g.label, name, exId, measure, record, feel, notes]);
			entries++;

			if (!sessionId.has(date)) {
				const sid = nextId('h');
				sessionId.set(date, sid);
				sqlSessions.push(`INSERT INTO sessions (id,date,program_id,day,notes) VALUES ('${sid}','${date}','history:${slug}',NULL,${sqlStr(notes)});`);
			}
			const weight = parseWeight(measure);
			const eid = exId || slugify(name) || `unknown-${slugify(g.label)}`; // never NULL (schema)
			const base = clean(`${g.label}: ${name} ${measure} ${record}`);
			// One sets row per actual set (matches the live logger's shape).
			const perSet = expandRecord(record, /sled/i.test(name));
			(perSet.length ? perSet : [{}]).forEach((s, k) => {
				const note = base + (s.note ? ` [${s.note}]` : '');
				sqlSets.push(
					`INSERT INTO sets (id,session_id,exercise_id,set_num,reps,weight,duration_s,notes,logged_at) VALUES ` +
						`('${nextId('s')}','${sessionId.get(date)}','${eid}',${k + 1},${s.reps ?? 'NULL'},${weight ?? 'NULL'},${s.duration_s ?? 'NULL'},${sqlStr(note)},'${date}');`
				);
			});
		}
	}

	writeFileSync(`${OUT}/${slug}.csv`, out.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
	console.log(`${slug.padEnd(28)} ${String(entries).padStart(4)} entries · ${sessionId.size} sessions`);
}

// ── snowboard sheet: session-overview + trick blocks ────────────────────
// Layout repeats per session: a "<date> | Session Overview" row, a "Board"
// header then its value row (board | location | · | focus | … | conditions),
// a "Skills Work" / "Trick" header, then trick rows (trick | landed? | · |
// confidence | … | notes) until the next date. Sessions → `sessions`; each
// landed/attempted trick → a `sets` row (exercise_id = trick slug).
{
	const ws = wb.Sheets['snowboard'];
	if (ws) {
		const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: false });
		const sessOut = [['date', 'board', 'location', 'focus', 'conditions']];
		const trickOut = [['date', 'trick', 'landed', 'confidence', 'notes']];
		const sessionId = new Map();
		const counters = [];
		let date = null;
		let section = null;

		const ensureSession = (day, notes) => {
			if (sessionId.has(date)) return sessionId.get(date);
			const sid = nextId('sb');
			sessionId.set(date, sid);
			sqlSessions.push(`INSERT INTO sessions (id,date,program_id,day,notes) VALUES ('${sid}','${date}','history:snowboard',${sqlStr(day)},${sqlStr(notes)});`);
			return sid;
		};

		for (const row of rows) {
			const c = (i) => clean(row[i]);
			if (c(2) === 'COUNTERS' || /^(days on snow|days trained|new tricks|backflip):/i.test(c(2))) {
				counters.push(`${c(2)} ${c(4)}`.trim());
				continue;
			}
			const d = parseSbDate(c(0));
			if (d) {
				date = d;
				section = null;
				continue;
			}
			if (!date) continue;
			const l1 = c(1);
			if (l1 === 'Board') { section = 'detail'; continue; }
			if (l1 === 'Trick') { section = 'tricks'; continue; }
			if (l1 === 'Skills Work' || l1 === 'Session Overview') continue;

			if (section === 'detail' && l1) {
				const [board, location, focus, conditions] = [l1, c(2), c(4), c(8)];
				sessOut.push([date, board, location, focus, conditions]);
				ensureSession(focus || board, [board, location, conditions].filter(Boolean).join(' · '));
				section = null;
			} else if (section === 'tricks' && l1 && l1 !== 'None') {
				const [trick, landed, conf, notes] = [l1, c(2), c(4), c(7)];
				trickOut.push([date, trick, landed, conf, notes]);
				const sid = ensureSession('', '');
				const setNotes = clean([`landed: ${landed || '—'}`, `confidence: ${conf || '—'}`, notes].filter((x) => x && !/: —$/.test(x)).join(' · '));
				sqlSets.push(`INSERT INTO sets (id,session_id,exercise_id,notes,logged_at) VALUES ('${nextId('s')}','${sid}','${slugify(trick)}',${sqlStr(setNotes)},'${date}');`);
			}
		}

		writeFileSync(`${OUT}/snowboard-sessions.csv`, sessOut.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
		writeFileSync(`${OUT}/snowboard-tricks.csv`, trickOut.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
		console.log(`snowboard                    ${trickOut.length - 1} tricks · ${sessionId.size} sessions   [${counters.join(', ')}]`);
	}
}

writeFileSync(
	`${OUT}/seed.sql`,
	[
		`-- Historical log seed (generated by scripts/import-log-history.mjs).`,
		`-- Apply once D1 exists:  wrangler d1 execute switchback --file log/history/seed.sql`,
		'',
		...sqlSessions,
		'',
		...sqlSets,
		''
	].join('\n')
);
console.log(`seed.sql                     ${sqlSessions.length} sessions · ${sqlSets.length} sets`);
