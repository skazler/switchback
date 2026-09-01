import { describe, expect, it } from 'vitest';
import {
	blockLabels,
	choiceHref,
	displayName,
	displayNote,
	isChoice,
	toRenderItems
} from './session-display';
import type { SessionRow } from './content/types';

const row = (r: Partial<SessionRow>): SessionRow => ({ name: '', ref: null, ...r });

describe('asterisk cleanup', () => {
	it('strips trailing footnote star from names', () => {
		expect(displayName('BB RDL*')).toBe('BB RDL');
		expect(displayName('BOX SQUAT* FAST')).toBe('BOX SQUAT* FAST'); // only trailing
		expect(displayName('SPRINTS*')).toBe('SPRINTS');
	});
	it('strips leading star from notes', () => {
		expect(displayNote('*could also do hack squat')).toBe('could also do hack squat');
		expect(displayNote('2 dl, 1 sl')).toBe('2 dl, 1 sl');
		expect(displayNote(undefined)).toBe('');
	});
});

describe('choice links', () => {
	it('detects choice cells', () => {
		expect(isChoice('QUAD EXERCISE CHOICE')).toBe(true);
		expect(isChoice('CHOICE*')).toBe(true);
		expect(isChoice('BB RDL')).toBe(false);
	});
	it('filters the library by body part when the cell names one', () => {
		expect(choiceHref(row({ name: 'QUAD EXERCISE CHOICE' }))).toBe('/library?body=quads');
		expect(choiceHref(row({ name: 'LOWER ACCESSORY LIFT CHOICE' }))).toBe(
			'/library?body=lower%20body'
		);
		expect(choiceHref(row({ name: 'REAR DELT CHOICE' }))).toBe('/library?body=shoulders');
		expect(choiceHref(row({ name: 'CHOICE', group: 'Shoulders' }))).toBe('/library?body=shoulders');
	});
	it('falls back to the most specific term when it names no body part', () => {
		expect(choiceHref(row({ name: 'CHOICE STABILITY MOVEMENT*' }))).toBe('/library?q=stability');
		expect(choiceHref(row({ name: 'CHOICE', group: 'Agility' }))).toBe('/library?q=agility');
		expect(choiceHref(row({ name: 'CHOICE' }))).toBe('/library');
	});
	it('opens the whole library when every word is generic', () => {
		// The group cell is stop-worded too, or "Accessory | Lift choice"
		// searches for the literal word "accessory" and finds nothing useful.
		expect(choiceHref(row({ name: 'Lift choice', group: 'Accessory' }))).toBe('/library');
		expect(choiceHref(row({ name: 'Optional session choice' }))).toBe('/library');
	});
});

describe('session / week dividers', () => {
	it('classifies two-a-day session bands (group column, bold)', () => {
		const items = toRenderItems([
			row({ group: '**Session 1**' }),
			row({ group: 'Warmup', name: 'DYNAMIC WARMUPS' }),
			row({ group: '**Session 2**' }),
			row({ group: 'Heavy Lifts', name: 'TRAP BAR DEADLIFT', sets: '4' })
		]);
		expect(items.map((i) => i.kind)).toEqual(['session', 'group', 'ex', 'session', 'group', 'ex']);
		expect(items[0]).toEqual({ kind: 'session', label: 'Session 1' });
	});

	it('classifies weekly rotation dividers (exercise column, no prescription)', () => {
		const items = toRenderItems([
			row({ group: 'Power', name: 'Week A' }),
			row({ name: 'CLEAN', sets: '3', reps: '3' }),
			row({ name: 'Week B' }),
			row({ name: 'HANG CLEAN', sets: '3' })
		]);
		expect(items.map((i) => i.kind)).toEqual(['group', 'week', 'ex', 'week', 'ex']);
		expect(items[1]).toEqual({ kind: 'week', label: 'Week A' });
	});
});

describe('block labels in a session', () => {
	it('carries a blank Block cell forward, the way the plan renders it', () => {
		expect(
			blockLabels([
				{ group: 'Power' },
				{ group: 'Posterior chain' },
				{},
				{},
				{ group: 'Core' },
				{}
			])
		).toEqual(['Power', 'Posterior chain', 'Posterior chain', 'Posterior chain', 'Core', 'Core']);
	});
	it('keeps a bottom-added extra out of the last block', () => {
		expect(blockLabels([{ group: 'Circuit ×5' }, {}, { extra: true }])).toEqual([
			'Circuit ×5',
			'Circuit ×5',
			''
		]);
	});
	it('keeps an extra added *into* a block inside it', () => {
		expect(blockLabels([{ group: 'Circuit ×5' }, { group: 'Circuit ×5', extra: true }])).toEqual([
			'Circuit ×5',
			'Circuit ×5'
		]);
	});
	it('leaves an ungrouped session ungrouped', () => {
		expect(blockLabels([{}, {}])).toEqual(['', '']);
	});
});
