import { describe, expect, it } from 'vitest';
import { resolvePlan, resolveToday } from './today';
import type { Program, ProgramDay, SessionRow } from './content/types';

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

// ── resolvePlan: the by-week progression table ──────────────────────
const dayRow = (name: string, notes: string): SessionRow => ({ name, ref: null, notes });

function progProgram(): Program {
	return {
		id: 'p',
		title: 'Test',
		status: 'active',
		schedule: 'weekly',
		start: '2026-06-29',
		overviewHtml: '',
		progression: [
			{
				week: 9,
				columns: [
					{ label: 'Phase', value: 'build' },
					{ label: 'Long ride', value: '1:45 Z2 (down)' },
					{ label: 'Sunday', value: 'easy 45–60 min ride' },
					{ label: 'Midweek intensity', value: '6×2 min VO2' }
				]
			}
		],
		days: [
			{ ...day('Sa', 6, 'sa-ride'), rows: [dayRow('Zone 2 endurance ride', 'duration ramps by week — see progression')] },
			{ ...day('Su', 0, 'su-bike-park'), rows: [dayRow('Bike park / skills', 'varies by week — see progression')] },
			{ ...day('W', 3, 'w-climb'), rows: [dayRow('Hangboard warm-up + climbing', '+ midweek VO2 from Build on (see progression)')] }
		]
	};
}

describe('resolvePlan', () => {
	const program = progProgram();
	const sheet = (slug: string) => program.days.find((d) => d.slug === slug)!;

	it('a weekday-named column binds to that weekday’s sheet', () => {
		const r = resolvePlan(sheet('su-bike-park'), program, 9);
		expect(r.rows[0].reps).toBe('easy 45–60 min ride');
		expect(r.rows[0].notes).toBe('varies by week');
	});

	it('word overlap still resolves columns that aren’t weekday-named', () => {
		expect(resolvePlan(sheet('sa-ride'), program, 9).rows[0].reps).toBe('1:45 Z2 (down)');
		expect(resolvePlan(sheet('w-climb'), program, 9).rows[0].reps).toBe('6×2 min VO2');
	});

	it('a dash cell leaves the sheet’s own prescription alone', () => {
		const p = progProgram();
		p.progression![0].columns = p.progression![0].columns.map((c) =>
			c.label === 'Midweek intensity' ? { ...c, value: '—' } : c
		);
		const w = p.days.find((d) => d.slug === 'w-climb')!;
		expect(resolvePlan(w, p, 9).rows[0].reps).toBeUndefined();
		expect(resolvePlan(w, p, 9).rows[0].notes).toContain('see progression');
	});

	it('a week with no progression row leaves the sheet alone', () => {
		expect(resolvePlan(sheet('su-bike-park'), program, 3).rows[0].reps).toBeUndefined();
		expect(resolvePlan(sheet('su-bike-park'), program, null).rows[0].reps).toBeUndefined();
	});
});
