<script lang="ts">
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let q = $state('');
	let category = $state('');
	let equip = $state('');

	// Seed filters from the URL (?q / ?category / ?equipment) so links from a
	// program's "choice" cells land pre-filtered. Reruns only on navigation,
	// so it doesn't clobber the user's own typing.
	$effect(() => {
		const p = page.url.searchParams;
		q = p.get('q') ?? '';
		category = p.get('category') ?? '';
		equip = p.get('equipment') ?? '';
	});

	const filtered = $derived(
		data.rows.filter((r) => {
			if (category && r.category !== category) return false;
			if (equip && !r.equipment.includes(equip)) return false;
			if (q) {
				const needle = q.toLowerCase();
				if (!r.name.toLowerCase().includes(needle) && !(r.group ?? '').toLowerCase().includes(needle))
					return false;
			}
			return true;
		})
	);

	function reset() {
		q = '';
		category = '';
		equip = '';
	}
</script>

<svelte:head>
	<title>Library · Switchback</title>
</svelte:head>

<p class="microlabel">Library · {data.rows.length} moves</p>
<h1 class="display">Library</h1>

<div class="filters">
	<input class="search" type="search" placeholder="Search moves…" bind:value={q} aria-label="Search moves" />
	<select bind:value={category} aria-label="Filter by category">
		<option value="">All categories</option>
		{#each data.categories as c}<option value={c}>{c}</option>{/each}
	</select>
	<select bind:value={equip} aria-label="Filter by equipment">
		<option value="">All equipment</option>
		{#each data.equipment as e}<option value={e}>{e}</option>{/each}
	</select>
	{#if q || category || equip}
		<button class="clear microlabel" onclick={reset}>Clear</button>
	{/if}
</div>

<p class="count microlabel">{filtered.length} shown</p>

<ol class="list">
	{#each filtered as r (r.id)}
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
				<span class="cat microlabel">{r.category ?? ''}</span>
			</div>
			<div class="sub muted">
				{#if r.group}<span>{r.group}</span>{/if}
				{#each r.equipment as e}<span class="chip">{e}</span>{/each}
			</div>
		</li>
	{/each}
	{#if filtered.length === 0}
		<li class="none muted">No moves match.</li>
	{/if}
</ol>

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
	.cat {
		text-align: right;
		white-space: nowrap;
	}
	.sub {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 0.8rem;
		margin-top: 3px;
	}
	.chip {
		border: 0.5px solid var(--hairline);
		padding: 0 6px;
	}
	.none {
		padding: 20px 0;
	}
</style>
