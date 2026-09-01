<script lang="ts">
	import { page } from '$app/state';
	import { categoryLabel } from '$lib/content/body';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let q = $state('');
	let category = $state('');
	let body = $state('');

	// Seed filters from the URL (?q / ?category / ?body) so links from a
	// program's "choice" cell land pre-filtered. Reruns only on navigation,
	// so it doesn't clobber the user's own typing.
	$effect(() => {
		const p = page.url.searchParams;
		q = p.get('q') ?? '';
		category = p.get('category') ?? '';
		body = p.get('body') ?? '';
	});

	const filtered = $derived(
		// Rows arrive sorted by category → body part → name, so the sections
		// below are just a scan; no re-sorting here.
		data.rows.filter((r) => {
			if (category && r.category !== category) return false;
			if (body && r.body !== body) return false;
			if (q) {
				const needle = q.toLowerCase();
				const hay = [r.name, r.category, r.body, r.group, r.subgroup].join(' ').toLowerCase();
				if (!hay.includes(needle)) return false;
			}
			return true;
		})
	);

	// Section headers: a category band, and a body-part rule inside it.
	type Section = { category: string | null; body: string | null; rows: typeof data.rows };
	const sections = $derived.by(() => {
		const out: Section[] = [];
		for (const r of filtered) {
			const last = out[out.length - 1];
			if (last && last.category === r.category && last.body === r.body) last.rows.push(r);
			else out.push({ category: r.category, body: r.body, rows: [r] });
		}
		return out;
	});

	function reset() {
		q = '';
		category = '';
		body = '';
	}
</script>

<svelte:head>
	<title>Library · Switchback</title>
</svelte:head>

<p class="microlabel">Library · {data.rows.length} moves</p>
<h1 class="display">Library</h1>

<div class="filters">
	<input
		class="search"
		type="search"
		placeholder="Search moves…"
		bind:value={q}
		aria-label="Search moves"
	/>
	<select bind:value={category} aria-label="Filter by category">
		<option value="">All categories</option>
		{#each data.categories as c}<option value={c}>{categoryLabel(c)}</option>{/each}
	</select>
	<select bind:value={body} aria-label="Filter by body part">
		<option value="">All body parts</option>
		{#each data.bodyParts as b}<option value={b}>{b}</option>{/each}
	</select>
	{#if q || category || body}
		<button class="clear microlabel" onclick={reset}>Clear</button>
	{/if}
</div>

<p class="count microlabel">{filtered.length} shown</p>

{#each sections as sec, i (`${sec.category}/${sec.body}`)}
	{#if i === 0 || sections[i - 1].category !== sec.category}
		<h2 class="catband display">{categoryLabel(sec.category ?? undefined)}</h2>
	{/if}
	<h3 class="bodyband microlabel">{sec.body ?? 'unsorted'}</h3>
	<ol class="list">
		{#each sec.rows as r (r.id)}
			<li class="row">
				<div class="line">
					<span class="name display">
						{#if r.url}
							<a href={r.url} target="_blank" rel="noopener noreferrer">{r.name}</a>
							{#if r.urlCount > 1}<span class="more microlabel">+{r.urlCount - 1}</span>{/if}
						{:else}
							{r.name}
						{/if}
					</span>
				</div>
				{#if r.path || r.note}
					<div class="sub muted">
						{#if r.path}<span>{r.path}</span>{/if}
						{#if r.note}<span class="note">{r.note}</span>{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/each}

{#if filtered.length === 0}
	<p class="none muted">No moves match.</p>
{/if}

<style>
	h1 {
		margin-bottom: 16px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 6px;
		position: sticky;
		top: 52px;
		background: var(--field);
		padding: 8px 0;
		z-index: 5;
	}
	.search {
		flex: 1 1 180px;
	}
	input,
	select {
		background: var(--field-raised);
		color: var(--ink);
		border: 1px solid var(--hairline);
		padding: 9px 10px;
		font-family: var(--font-body);
		font-size: 0.9rem;
		min-height: var(--tap);
	}
	input:focus,
	select:focus {
		border-color: var(--blaze);
		outline: none;
	}
	.clear {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		cursor: pointer;
		padding: 0 12px;
	}
	.clear:hover {
		color: var(--ink);
	}
	.count {
		margin: 0 0 8px;
	}
	.catband {
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		margin: 26px 0 0;
		padding-bottom: 4px;
		border-bottom: var(--rule) solid var(--ink);
	}
	.bodyband {
		margin: 14px 0 0;
		color: var(--blaze);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		padding: 9px 0;
		border-top: 0.5px solid var(--hairline);
	}
	.line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.name {
		font-size: 1.2rem;
		font-weight: 500;
	}
	.name a {
		border-bottom: 1px solid var(--hairline);
	}
	.name a:hover {
		border-bottom-color: var(--blaze);
	}
	.more {
		margin-left: 4px;
		color: var(--blaze);
	}
	.sub {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 0.8rem;
		margin-top: 3px;
	}
	.none {
		padding: 20px 0;
	}
</style>
