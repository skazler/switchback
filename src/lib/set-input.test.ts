import { describe, expect, it } from 'vitest';
import { durationInputValue, formatDistance, formatDuration, parseDistance, parseDuration } from './set-input';

describe('duration entry', () => {
	it('reads a bare number as minutes', () => {
		expect(parseDuration('45')).toBe(45 * 60);
		expect(parseDuration('90')).toBe(90 * 60);
		expect(parseDuration('22.5')).toBe(1350);
		expect(parseDuration(' 60 ')).toBe(3600);
	});
	it('reads hours:minutes', () => {
		expect(parseDuration('1:30')).toBe(90 * 60);
		expect(parseDuration('2:00')).toBe(2 * 3600);
		expect(parseDuration('0:45')).toBe(45 * 60);
		expect(parseDuration('1:05:30')).toBe(3930);
	});
	it('reads unit-suffixed forms', () => {
		expect(parseDuration('90m')).toBe(90 * 60);
		expect(parseDuration('90 min')).toBe(90 * 60);
		expect(parseDuration('2h')).toBe(2 * 3600);
		expect(parseDuration('1.5h')).toBe(90 * 60);
		expect(parseDuration('1h30m')).toBe(90 * 60);
		expect(parseDuration('1h30')).toBe(90 * 60);
		expect(parseDuration('1H30M')).toBe(90 * 60);
	});
	it('rejects what it cannot read', () => {
		expect(parseDuration('')).toBeNull();
		expect(parseDuration('  ')).toBeNull();
		expect(parseDuration('abc')).toBeNull();
		expect(parseDuration('1:')).toBeNull();
		expect(parseDuration('-30')).toBeNull();
		expect(parseDuration('1:2:3:4')).toBeNull();
	});
});

describe('duration display', () => {
	it('stays in minutes under an hour', () => {
		expect(formatDuration(45 * 60)).toBe('45m');
		expect(formatDuration(0)).toBe('0m');
		expect(formatDuration(1350)).toBe('23m'); // rounds to the minute
	});
	it('splits into hours past an hour', () => {
		expect(formatDuration(90 * 60)).toBe('1h30m');
		expect(formatDuration(3600)).toBe('1h');
		expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2h5m');
	});
	it('round-trips through the input value', () => {
		for (const typed of ['45', '1:30', '2:00', '90']) {
			const secs = parseDuration(typed)!;
			expect(parseDuration(durationInputValue(secs))).toBe(secs);
		}
		expect(durationInputValue(90 * 60)).toBe('1:30');
		expect(durationInputValue(45 * 60)).toBe('45');
		expect(durationInputValue(2 * 3600 + 5 * 60)).toBe('2:05');
	});
});

describe('distance entry', () => {
	it('takes decimals', () => {
		expect(parseDistance('12.4')).toBe(12.4);
		expect(parseDistance('.5')).toBe(0.5);
		expect(parseDistance('12')).toBe(12);
		expect(parseDistance('12,4')).toBe(12.4);
		expect(parseDistance('12.4 mi')).toBe(12.4);
		expect(parseDistance(' 8.75miles ')).toBe(8.75);
	});
	it('rejects what it cannot read', () => {
		expect(parseDistance('')).toBeNull();
		expect(parseDistance('abc')).toBeNull();
		expect(parseDistance('12.4.5')).toBeNull();
		expect(parseDistance('-3')).toBeNull();
	});
	it('displays without trailing zeros', () => {
		expect(formatDistance(12.4)).toBe('12.4');
		expect(formatDistance(12)).toBe('12');
		expect(formatDistance(12.456)).toBe('12.46');
		expect(formatDistance(12.5)).toBe('12.5');
	});
});
