import { describe, expect, it } from 'vitest';
import { resolveToday } from './today';
import type { Program, ProgramDay } from './content/types';

function day(code: string, weekday: number, slug: string): ProgramDay {
	return { slug, code, weekday, label: slug, rows: [], marker: 'blue' };
}

const program: Program = {
	id: '2026-q2',
	title: 'Test',
	status: 'active',
	schedule: 'weekly',
	start: '2025-12-29', // a Monday
	overviewHtml: '',
	phases: [
		{ label: 'base', weeks: [1, 6], load: 3 },
		{ label: 'build', weeks: [7, 12], load: 6 }
	],
	days: [
		day('M', 1, 'm-upper'),
		day('T', 2, 't-lower'),
		day('Sa', 6, 'sa-zone-2')
	]
};

// Noon Chicago on a given calendar date (CST = UTC-6 in winter, CDT = UTC-5 summer).
const at = (iso: string) => new Date(`${iso}T18:00:00Z`);

describe('resolveToday', () => {
	it('no program → no-program', () => {
		expect(resolveToday(undefined)).toEqual({ status: 'no-program' });
	});

	it('week 1 on the start Monday, with a session', () => {
		const r = resolveToday(program, at('2025-12-29'));
		expect(r.status).toBe('session');
		if (r.status === 'session') {
			expect(r.week).toBe(1);
			expect(r.day.slug).toBe('m-upper');
			expect(r.phase?.label).toBe('base');
		}
	});

	it('week advances every 7 days', () => {
		const r = resolveToday(program, at('2026-01-05')); // +7 days, a Monday
		expect(r.status === 'session' && r.week).toBe(2);
	});

	it('a weekday with no sheet → rest', () => {
		const r = resolveToday(program, at('2025-12-31')); // Wednesday
		expect(r.status).toBe('rest');
		expect(r.status === 'rest' && r.week).toBe(1);
	});

	it('before the start date → before-start', () => {
		const r = resolveToday(program, at('2025-12-20'));
		expect(r).toMatchObject({ status: 'before-start', week: 0, startsOn: '2025-12-29' });
	});

	it('build phase resolves in week 7', () => {
		const r = resolveToday(program, at('2026-02-09')); // 6 weeks after start, Monday → week 7
		expect(r.status === 'session' && r.phase?.label).toBe('build');
	});
});
