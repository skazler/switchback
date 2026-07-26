import { describe, expect, it } from 'vitest';
import { addDays, dateForWeekday, formatDay, formatWeekRange, weekStart } from './plan-dates';

// The live program: 2026-race-prep, start Monday 29 JUN 2026, 20 weeks.
const START = '2026-06-29';

describe('weekStart', () => {
	it('week 1 is the start Monday', () => {
		expect(weekStart(START, 1)).toBe('2026-06-29');
	});

	it('advances 7 days per week across month boundaries', () => {
		expect(weekStart(START, 6)).toBe('2026-08-03');
		expect(weekStart(START, 12)).toBe('2026-09-14');
		expect(weekStart(START, 20)).toBe('2026-11-09');
	});
});

describe('dateForWeekday', () => {
	it('maps Mon…Sun onto the week, with Sunday last', () => {
		expect(dateForWeekday(START, 1, 1)).toBe('2026-06-29'); // Mon
		expect(dateForWeekday(START, 1, 6)).toBe('2026-07-04'); // Sat
		expect(dateForWeekday(START, 1, 0)).toBe('2026-07-05'); // Sun
	});

	it('puts the Reveille pre-ride on Saturday 19 SEP (week 12)', () => {
		expect(dateForWeekday(START, 12, 6)).toBe('2026-09-19');
	});

	it('puts race day on Saturday 14 NOV (week 20)', () => {
		expect(dateForWeekday(START, 20, 6)).toBe('2026-11-14');
	});
});

describe('addDays', () => {
	it('crosses a month boundary', () => {
		expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
	});
});

describe('formatDay', () => {
	it('renders day + uppercase month, unpadded', () => {
		expect(formatDay('2026-09-19')).toBe('19 SEP');
		expect(formatDay('2026-07-04')).toBe('4 JUL');
	});
});

describe('formatWeekRange', () => {
	it('collapses the month when the week does not cross one', () => {
		expect(formatWeekRange(START, 12)).toBe('14–20 SEP');
	});

	it('names both months when the week straddles them', () => {
		expect(formatWeekRange(START, 1)).toBe('29 JUN – 5 JUL');
	});
});
