import { describe, expect, it } from 'vitest';
import { parseExercises, parseBlock, parseProgram, WEEKDAY } from './parse';
import { buildResolver, intensityFor, minReps, normalizeName } from './resolve';
import type { Block, Exercise } from './types';

const exercises: Exercise[] = [
	{ id: 'db-shoulder-press', name: 'DB Shoulder Press', urls: ['https://ex/1'] },
	{ id: 'box-squat', name: 'Box Squat' },
	{ id: 'bb-rdl', name: 'BB RDL' }
];
const blocks: Block[] = [
	{ id: 'rotator-cuff-work', title: 'Rotator Cuff Work', appearsAs: 'ROTATOR CUFF WORK — 2 sets', bodyHtml: '' }
];

describe('normalizeName', () => {
	it('strips footnote stars, collapses space, lowercases', () => {
		expect(normalizeName('BB RDL*')).toBe('bb rdl');
		expect(normalizeName('  Box   Squat ')).toBe('box squat');
	});
});

describe('resolver', () => {
	const resolve = buildResolver(exercises, blocks);
	it('resolves an exercise by name, case-insensitive, with trailing star', () => {
		expect(resolve('DB SHOULDER PRESS')).toEqual({
			kind: 'exercise',
			id: 'db-shoulder-press',
			name: 'DB Shoulder Press',
			url: 'https://ex/1'
		});
		expect(resolve('BB RDL*')?.id).toBe('bb-rdl');
	});
	it('resolves a block by title', () => {
		expect(resolve('ROTATOR CUFF WORK')).toEqual({
			kind: 'block',
			id: 'rotator-cuff-work',
			title: 'Rotator Cuff Work'
		});
	});
	it('returns null for unknown names', () => {
		expect(resolve('30MINS CHOICE')).toBeNull();
		expect(resolve('')).toBeNull();
	});
});

describe('intensity heuristic', () => {
	it('minReps picks the low end', () => {
		expect(minReps('8 to 12')).toBe(8);
		expect(minReps('>25')).toBe(25);
		expect(minReps('AMRAP')).toBeUndefined();
	});
	it('maps prehab→green, accessory→blue, low-rep→black, circuit→double-black', () => {
		expect(intensityFor({ group: 'P/rehab', name: 'Rotator Cuff Work' })).toBe('green');
		expect(intensityFor({ group: 'Lifts', name: 'DB Shoulder Press', reps: '8 to 12' })).toBe('blue');
		expect(intensityFor({ group: 'Squat Pattern', name: 'Box Squat', reps: '5' })).toBe('black');
		expect(intensityFor({ name: 'Fireground Circuit' })).toBe('double-black');
	});
});

describe('parseExercises', () => {
	it('reads the exercises array', () => {
		const out = parseExercises('exercises:\n  - name: "A"\n    id: a\n    category: strength-hypertrophy\n');
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({ id: 'a', name: 'A' });
	});
});

describe('parseBlock', () => {
	it('extracts front matter and renders the body', () => {
		const b = parseBlock('---\nid: x\ntitle: X Work\ntype: choice-menu\nappears-as: "X — 2 sets"\n---\n\nPick 1.\n');
		expect(b).toMatchObject({ id: 'x', title: 'X Work', type: 'choice-menu', appearsAs: 'X — 2 sets' });
		expect(b.bodyHtml).toContain('Pick 1.');
	});
});

const PROGRAM = `---
id: test
title: Test
status: active
start: 2025-12-29
---

Some overview prose.

## upper acc  <!-- M upper acc -->

| Block | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| Lifts | DB SHOULDER PRESS | 3 | 8 to 12 | 3:00 | |
| P/rehab | ROTATOR CUFF WORK | 2 | | | |

## zone 2  <!-- Sa zone 2 -->

| Block | Exercise | Sets | Reps | Rest | Notes |
|---|---|---|---|---|---|
| Zone 2 | 30MINS CHOICE | | | | run |
`;

describe('parseProgram', () => {
	const resolve = buildResolver(exercises, blocks);
	it('extracts days, weekday codes, slugs, and resolved rows', () => {
		const { program, badDayFormats, unresolved } = parseProgram(PROGRAM, resolve);
		expect(program.id).toBe('test');
		expect(program.status).toBe('active');
		// YAML parses the date to a Date object — must normalize back to ISO.
		expect(program.start).toBe('2025-12-29');
		expect(program.overviewHtml).toContain('overview prose');
		expect(program.days.map((d) => d.slug)).toEqual(['m-upper-acc', 'sa-zone-2']);
		expect(program.days[0].weekday).toBe(WEEKDAY['m']);
		expect(program.days[1].weekday).toBe(WEEKDAY['sa']);

		const row = program.days[0].rows[0];
		expect(row.name).toBe('DB SHOULDER PRESS');
		expect(row.ref?.kind).toBe('exercise');
		expect(row.sets).toBe('3');
		expect(row.reps).toBe('8 to 12');

		expect(badDayFormats).toEqual([]);
		expect(unresolved).toContain('30MINS CHOICE');
	});

	it('day marker is the hardest row marker', () => {
		const { program } = parseProgram(PROGRAM, resolve);
		// upper acc has a green (prehab) + blue (accessory) → blue
		expect(program.days[0].marker).toBe('blue');
	});

	it('flags an unknown weekday code', () => {
		const bad = PROGRAM.replace('<!-- M upper acc -->', '<!-- Zz upper acc -->');
		const { badDayFormats } = parseProgram(bad, resolve);
		expect(badDayFormats).toContain('Zz');
	});

	it('disambiguates duplicate labels with unique slugs', () => {
		const dup = PROGRAM.replace('<!-- Sa zone 2 -->', '<!-- Su upper acc -->').replace(
			'## zone 2  <!-- Su upper acc -->',
			'## upper acc  <!-- Su upper acc -->'
		);
		const { program } = parseProgram(dup, resolve);
		const slugs = program.days.map((d) => d.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});
