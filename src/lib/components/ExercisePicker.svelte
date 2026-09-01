<script lang="ts">
	// The one way to name a move anywhere you write a workout. A plain
	// <datalist> could only match the start of a name, which is useless when
	// you remember the body part but not the exact spelling ("that adductor
	// thing"). So: one search box over name + category + body part + the
	// sheet's group/subgroup, results grouped the way /library groups them.
	import { categoryLabel, bodyRank, categoryRank } from '$lib/content/body';
	import { tick } from 'svelte';

	export interface LibraryEntry {
		id: string;
		name: string;
		category?: string | null;
		body?: string | null;
		group?: string | null;
		subgroup?: string | null;
	}

	let {
		library,
		placeholder = 'Search the library…',
		autofocus = true,
		onpick,
		oncancel
	}: {
		library: LibraryEntry[];
		placeholder?: string;
		autofocus?: boolean;
		/** picked from the library, or a free-typed name with no `entry` */
		onpick: (choice: { name: string; entry?: LibraryEntry }) => void;
		oncancel?: () => void;
	} = $props();

	// How many rows to render. 580 entries is too many to paint on every
	// keystroke, and nobody scrolls past the first screenful anyway.
	const CAP = 80;

	let q = $state('');
	let cursor = $state(0);
	let input = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);

	$effect(() => {
		if (autofocus) input?.focus();
	});

	const sorted = $derived(
		[...library].sort(
			(a, b) =>
				categoryRank(a.category ?? undefined) - categoryRank(b.category ?? undefined) ||
				bodyRank(a.body ?? undefined) - bodyRank(b.body ?? undefined) ||
				a.name.localeCompare(b.name)
		)
	);

	const terms = $derived(q.trim().toLowerCase().split(/\s+/).filter(Boolean));

	// Every term has to land somewhere in the entry's haystack, so "kb hips"
	// and "hips kb" both work and neither needs the exact name.
	const matches = $derived(
		terms.length === 0
			? sorted
			: sorted.filter((e) => {
					const hay = [e.name, e.category, e.body, e.group, e.subgroup]
						.filter(Boolean)
						.join(' ')
						.toLowerCase();
					return terms.every((t) => hay.includes(t));
				})
	);

	const shown = $derived(matches.slice(0, CAP));

	$effect(() => {
		// The query is what moves the result set under the highlight — reading
		// it here (not `shown.length`, which can stay equal across a very
		// different set) is what makes the reset fire on every retype.
		void q;
		cursor = 0;
	});

	async function move(delta: number) {
		if (!shown.length) return;
		cursor = (cursor + delta + shown.length) % shown.length;
		await tick();
		listEl?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
	}

	function keydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			move(1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			move(-1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			oncancel?.();
		}
	}

	/** Enter takes the highlighted row; with no results it takes the raw text,
	 *  so a move that isn't in the library yet is still loggable. */
	function commit() {
		const hit = shown[cursor];
		if (hit) onpick({ name: hit.name, entry: hit });
		else if (q.trim()) onpick({ name: q.trim() });
	}

	const facets = (e: LibraryEntry) =>
		[categoryLabel(e.category ?? undefined), e.body].filter(Boolean).join(' · ');
</script>

<div class="picker">
	<div class="bar">
		<input
			bind:this={input}
			bind:value={q}
			onkeydown={keydown}
			type="search"
			{placeholder}
			aria-label="Search the exercise library"
			autocomplete="off"
		/>
		{#if oncancel}
			<button class="cancel microlabel" onclick={() => oncancel?.()}>Cancel</button>
		{/if}
	</div>

	<p class="hits microlabel">
		{matches.length} match{matches.length === 1 ? '' : 'es'}{matches.length > CAP
			? ` · showing ${CAP}`
			: ''}
	</p>

	<ul class="results" bind:this={listEl}>
		{#each shown as e, i (e.id)}
			{@const newCat = i === 0 || shown[i - 1].category !== e.category}
			{@const newBody = newCat || shown[i - 1].body !== e.body}
			{#if newBody}
				<li class="band microlabel">{facets(e)}</li>
			{/if}
			<li>
				<button
					class="hit"
					class:on={i === cursor}
					data-on={i === cursor}
					onmouseenter={() => (cursor = i)}
					onclick={() => onpick({ name: e.name, entry: e })}
				>
					<span class="nm">{e.name}</span>
					{#if e.group}<span class="grp muted">{e.group}</span>{/if}
				</button>
			</li>
		{/each}
		{#if !shown.length}
			<li class="empty muted">
				{#if q.trim()}
					Nothing in the library matches.
					<button class="asis" onclick={commit}>Add “{q.trim()}” anyway →</button>
				{:else}
					Type to search.
				{/if}
			</li>
		{/if}
	</ul>
</div>

<style>
	.picker {
		border: 1px solid var(--hairline);
		background: var(--field-raised);
	}
	.bar {
		display: flex;
		gap: 6px;
		padding: 8px;
		border-bottom: 0.5px solid var(--hairline);
	}
	input {
		flex: 1;
		background: var(--field);
		color: var(--ink);
		border: 1px solid var(--hairline);
		padding: 9px 10px;
		font-family: var(--font-body);
		font-size: 0.95rem;
		min-height: var(--tap);
	}
	input:focus {
		border-color: var(--blaze);
		outline: none;
	}
	.cancel {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		cursor: pointer;
		padding: 0 12px;
	}
	.cancel:hover {
		color: var(--ink);
	}
	.hits {
		margin: 0;
		padding: 6px 10px;
		color: var(--muted);
	}
	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 46vh;
		overflow-y: auto;
	}
	.band {
		position: sticky;
		top: 0;
		background: var(--field);
		color: var(--blaze);
		padding: 5px 10px;
		border-top: 0.5px solid var(--hairline);
		border-bottom: 0.5px solid var(--hairline);
	}
	.hit {
		display: flex;
		width: 100%;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 0.5px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.95rem;
		padding: 11px 10px;
		min-height: var(--tap);
		cursor: pointer;
	}
	.hit.on {
		background: var(--field);
		box-shadow: inset 3px 0 0 var(--blaze);
	}
	.grp {
		font-size: 0.75rem;
		white-space: nowrap;
	}
	.empty {
		padding: 14px 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: flex-start;
	}
	.asis {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--blaze);
		font-family: var(--font-body);
		font-size: 0.9rem;
		padding: 8px 12px;
		cursor: pointer;
	}
	.asis:hover {
		border-color: var(--blaze);
	}
</style>
