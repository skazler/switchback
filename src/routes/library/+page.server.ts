import { loadContent } from '$lib/content/load.server';

export function load() {
	const { exercises } = loadContent();
	const rows = exercises.map((e) => ({
		id: e.id,
		name: e.name,
		category: e.category ?? null,
		group: e.group ?? null,
		equipment: e.equipment ?? [],
		note: e.note ?? null,
		url: e.urls?.[0] ?? null,
		urlCount: e.urls?.length ?? 0
	}));

	const uniq = (xs: (string | null)[]) =>
		[...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

	return {
		rows,
		categories: uniq(rows.map((r) => r.category)),
		equipment: uniq(rows.flatMap((r) => r.equipment))
	};
}
