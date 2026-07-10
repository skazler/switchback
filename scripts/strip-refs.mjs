// Strip dead cross-sheet references from program overviews. The old Google
// Sheets links (exercise compilation, notes on training, AAR/CPAT grids, the
// SB skills sheet, running sheet) are superseded: the library holds exercises
// and skills, /notes holds the training notes. The source .xlsx are gone, so
// we edit the generated/authored .md in place.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEAD = new Set([
	'references', 'aar', 'cpat events', 'cpat', 'exercise compilation',
	'notes on training', 'sb skills', 'running'
]);

function isDeadLine(line) {
	const t = line.trim();
	if (!t) return false;
	if (t.startsWith('|')) {
		const cells = t.split('|').map((c) => c.trim()).filter(Boolean);
		if (cells[0] === '---' || cells.every((c) => /^-+$/.test(c))) return false; // separator
		return cells.length > 0 && cells.every((c) => DEAD.has(c.toLowerCase()));
	}
	// bullet / bold-label reference lines, e.g. "- REFERENCES Exercise compilation"
	const s = t
		.replace(/\*/g, '') // all markdown bold markers
		.replace(/^[-\s]+/, '') // leading bullet
		.replace(/—/g, ' ')
		.replace(/\breferences\b/i, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
	return DEAD.has(s);
}

function walk(dir) {
	const out = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p));
		else if (e.name.endsWith('.md')) out.push(p);
	}
	return out;
}

let total = 0;
for (const file of walk('programs')) {
	const lines = readFileSync(file, 'utf-8').split('\n');
	const kept = lines.filter((l) => !isDeadLine(l));
	const removed = lines.length - kept.length;
	if (removed) {
		writeFileSync(file, kept.join('\n'));
		total += removed;
		console.log(`${file}: -${removed}`);
	}
}
console.log(`stripped ${total} dead-reference line(s)`);
