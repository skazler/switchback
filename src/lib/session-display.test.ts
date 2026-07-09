import { describe, expect, it } from 'vitest';
import { choiceHref, displayName, displayNote, isChoice, toRenderItems } from './session-display';
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
	it('points at the library with the most specific term', () => {
		expect(choiceHref(row({ name: 'QUAD EXERCISE CHOICE' }))).toBe('/library?q=quad');
		expect(choiceHref(row({ name: 'CHOICE STABILITY MOVEMENT*' }))).toBe('/library?q=stability');
		expect(choiceHref(row({ name: 'CHOICE', group: 'Agility' }))).toBe('/library?q=agility');
		expect(choiceHref(row({ name: 'CHOICE' }))).toBe('/library');
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
