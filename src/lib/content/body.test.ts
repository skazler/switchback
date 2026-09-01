import { describe, expect, it } from 'vitest';
import { bodyPartFor, bodyRank, categoryLabel, categoryRank } from './body';

const ex = (name: string, category?: string, group?: string, subgroup?: string) => ({
	name,
	category,
	group,
	subgroup
});

describe('sheet labels win', () => {
	it('reads the body part off subgroup first', () => {
		expect(bodyPartFor(ex('Front squat', 'strength-hypertrophy', 'Legs', 'Quads'))).toBe('quads');
		expect(bodyPartFor(ex('Reverse curls', 'strength-hypertrophy', 'Arms', 'Forearms'))).toBe(
			'wrists & forearms'
		);
		expect(bodyPartFor(ex('Taps', 'prehab-mobility', 'Prehab/Mobility/Activation', 'Ankle'))).toBe(
			'calves & ankles'
		);
	});
	it('falls back to group when there is no subgroup', () => {
		expect(bodyPartFor(ex('Bench press', 'strength-hypertrophy', 'Chest'))).toBe('chest');
		expect(bodyPartFor(ex('Ab wheel', 'strength-hypertrophy', 'Abs'))).toBe('core');
	});
	it('keeps a deliberate generic label instead of guessing from the name', () => {
		// Plyos are lower-body work as a sheet; "Squat jumps" must not be
		// reclassified as quads just because the word "squat" is in it.
		expect(bodyPartFor(ex('Squat jumps', 'athleticism', 'Plyos'))).toBe('lower body');
		expect(bodyPartFor(ex('Back squat', 'strength-hypertrophy', 'Legs', 'All'))).toBe('lower body');
		expect(bodyPartFor(ex('Bench throws (SM)', 'athleticism', 'Explosiveness/Power', 'Upper'))).toBe(
			'upper body'
		);
	});
});

describe('name-keyword fallback', () => {
	const pnp = (name: string) => bodyPartFor(ex(name, 'conditioning', 'Plug-and-Play'));

	it('sorts the flat Plug-and-Play list', () => {
		expect(pnp('Kettlebell Swings')).toBe('hips & glutes');
		expect(pnp('Goblet Squats')).toBe('quads');
		expect(pnp('Gorilla Row')).toBe('back');
		expect(pnp('Pushups Variations')).toBe('chest');
		expect(pnp('Situps')).toBe('core');
		expect(pnp('Push Press (DB, BB, Etc)')).toBe('shoulders');
	});
	it('leaves genuinely whole-body work alone', () => {
		expect(pnp('Burpees')).toBe('full body');
		expect(pnp('Rower')).toBe('full body');
		expect(pnp('Devils Press')).toBe('full body');
		expect(pnp('Bear Crawl')).toBe('full body');
	});
	it('orders the keywords so the specific match wins', () => {
		// "curl" would otherwise take these to arms, "press"/"row" to
		// shoulders/back, "squat" to quads.
		expect(pnp('Seated hamstring curl')).toBe('hamstrings');
		expect(pnp('DB Bench')).toBe('chest');
		expect(pnp('Sprint (Bike, Row, Run, Sled Resisted)')).toBe('lower body');
	});
	it('treats sport skills as skills, not body-part work', () => {
		expect(bodyPartFor(ex('Stick handling variety', 'hockey-skills', 'Stick handling'))).toBe(
			'full body'
		);
		expect(bodyPartFor(ex('Press drills 1', 'snowboard-skills', 'Home Practice'))).toBe('full body');
	});
});

describe('display order', () => {
	it('ranks categories in the authored order, unknowns last', () => {
		expect(categoryRank('strength-hypertrophy')).toBeLessThan(categoryRank('conditioning'));
		expect(categoryRank('hockey-skills')).toBeLessThan(categoryRank('made-up'));
	});
	it('ranks body parts head-to-toe, unknowns last', () => {
		expect(bodyRank('chest')).toBeLessThan(bodyRank('quads'));
		expect(bodyRank('quads')).toBeLessThan(bodyRank(undefined));
	});
	it('labels categories for display', () => {
		expect(categoryLabel('prehab-mobility')).toBe('Prehab / mobility');
		expect(categoryLabel(undefined)).toBe('Uncategorized');
	});
});
