import { loadContent } from '$lib/content/load.server';

// Collapse the many authored purposes into the display categories on /routes.
// Title/purpose prefix wins over firefighter-ness (a "Hypertrophy & Firefighter"
// plan is Hypertrophy). Skill-rotation programs (hockey, snowboard, …) group
// into one "Skills" section regardless of sport. Anything unmatched keeps its
// own purpose.
function categoryOf(title: string, purpose: string | undefined): string {
	const t = title.toLowerCase().replace(/^["']|["']$/g, '').trimStart();
	const p = (purpose ?? '').toLowerCase().trimStart();
	const startsEither = (kw: string) => t.startsWith(kw) || p.startsWith(kw);
	if (startsEither('hypertrophy')) return 'Hypertrophy';
	if (startsEither('running') || startsEither('run ')) return 'Running';
	if (/firefighter|cpat|fire academy|firecamp/.test(`${t} ${p}`)) return 'Tactical conditioning';
	return purpose ?? 'Other';
}

export function load() {
	const c = loadContent();
	return {
		programs: c.programs.map((p) => ({
			id: p.id,
			title: p.title,
			status: p.status,
			days: p.days.length,
			purpose: p.purpose ?? null,
			category: p.level === 'skill' ? 'Skills' : categoryOf(p.title, p.purpose),
			level: p.level ?? null,
			series: p.series ?? null,
			start: p.start ?? null,
			source: p.source ?? null
		}))
	};
}
