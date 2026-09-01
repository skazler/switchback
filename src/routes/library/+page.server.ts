import { loadContent } from '$lib/content/load.server';
import {
	BODY_PARTS,
	CATEGORY_ORDER,
	bodyRank,
	categoryLabel,
	categoryRank
} from '$lib/content/body';

const tokens = (s: string) =>
	s
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

/**
 * The sheet's group/subgroup often just restates the heading it sits under
 * ("Chest" under STRENGTH & HYPERTROPHY / CHEST). Keep only the part that
 * says something the category + body-part bands didn't.
 */
function sheetPath(category: string | undefined, body: string | undefined, parts: (string | undefined)[]): string {
	const band = new Set(tokens(`${categoryLabel(category)} ${body ?? ''}`));
	return parts
		.filter((p): p is string => !!p)
		.filter((p) => !tokens(p).every((t) => band.has(t)))
		.join(' · ');
}

export function load() {
	const rows = loadContent().exercises.map((e) => ({
		id: e.id,
		name: e.name,
		category: e.category ?? null,
		body: e.body ?? null,
		group: e.group ?? null,
		subgroup: e.subgroup ?? null,
		path: sheetPath(e.category, e.body, [e.group, e.subgroup]),
		note: e.note ?? null,
		url: e.urls?.[0] ?? null,
		urlCount: e.urls?.length ?? 0
	}));

	// Baked in the order the page renders them, so the client only filters.
	rows.sort(
		(a, b) =>
			categoryRank(a.category ?? undefined) - categoryRank(b.category ?? undefined) ||
			(a.category ?? '').localeCompare(b.category ?? '') ||
			bodyRank(a.body ?? undefined) - bodyRank(b.body ?? undefined) ||
			a.name.localeCompare(b.name)
	);

	// Only the facets that actually occur, in vocabulary order.
	const present = <T extends string>(all: readonly T[], seen: Set<string>) =>
		all.filter((v) => seen.has(v));

	return {
		rows,
		categories: present(CATEGORY_ORDER, new Set(rows.map((r) => r.category ?? ''))),
		bodyParts: present(BODY_PARTS, new Set(rows.map((r) => r.body ?? '')))
	};
}
