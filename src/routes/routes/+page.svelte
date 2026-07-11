<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	type Row = PageData['programs'][number];

	let level = $state('');
	let category = $state('');

	const levels = $derived([...new Set(data.programs.map((p) => p.level).filter(Boolean))] as string[]);
	const categories = $derived(
		[...new Set(data.programs.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)) as string[]
	);

	const shown = $derived(
		data.programs.filter((p) => (!level || p.level === level) && (!category || p.category === category))
	);

	// Group by category → then by series (a plan's evolution). Within a series,
	// newest `start` is the head; older versions are its history.
	const grouped = $derived.by(() => {
		const byCategory = new Map<string, Row[]>();
		for (const p of shown) {
			const key = p.category ?? 'Other';
			(byCategory.get(key) ?? byCategory.set(key, []).get(key)!).push(p);
		}
		return [...byCategory.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([categoryName, rows]) => {
				const bySeries = new Map<string, Row[]>();
				for (const r of rows) {
					const key = r.series ?? r.id;
					(bySeries.get(key) ?? bySeries.set(key, []).get(key)!).push(r);
				}
				const lineages = [...bySeries.values()].map((versions) => {
					versions.sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
					// active head first even if a dated version sorts above it
					versions.sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0));
					return { head: versions[0], history: versions.slice(1) };
				});
				lineages.sort((a, b) =>
					a.head.status === b.head.status ? 0 : a.head.status === 'active' ? -1 : 1
				);
				return { category: categoryName, lineages };
			});
	});

	const href = (p: Row) => (p.status === 'active' ? '/route' : `/routes/${p.id}`);
</script>

<svelte:head>
	<title>Programs · Switchback</title>
</svelte:head>

<p class="microlabel">All programs · {data.programs.length}</p>
<h1 class="display">Routes</h1>

{#if levels.length || categories.length}
	<div class="filters">
		{#if categories.length}
			<select bind:value={category} aria-label="Filter by category">
				<option value="">All categories</option>
				{#each categories as c}<option value={c}>{c}</option>{/each}
			</select>
		{/if}
		{#if levels.length}
			<div class="chips">
				<button class="chip microlabel" class:on={level === ''} onclick={() => (level = '')}>All levels</button>
				{#each levels as l}
					<button class="chip microlabel" class:on={level === l} onclick={() => (level = l)}>{l}</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

{#each grouped as group}
	<section class="purpose">
		<h2 class="phead display">{group.category}</h2>
		<ol class="list">
			{#each group.lineages as { head, history }}
				<li class="lineage">
					<a class="prow" class:active={head.status === 'active'} href={href(head)}>
						<span class="ptitle display">{head.title}</span>
						<span class="pmeta microlabel">
							{#if head.status === 'active'}<span class="badge">active</span>{/if}
							{#if head.level}{head.level} · {/if}{head.days} days
						</span>
						<span class="arrow" aria-hidden="true">→</span>
					</a>
					{#if history.length}
						<ul class="history">
							{#each history as v}
								<li>
									<a class="vrow" href={href(v)}>
										<span class="microlabel muted">earlier</span>
										<span class="vtitle">{v.title}</span>
										{#if v.start}<span class="microlabel muted">{v.start}</span>{/if}
										<span class="arrow" aria-hidden="true">→</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/each}

<style>
	h1 {
		margin-bottom: 14px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin-bottom: 18px;
	}
	select {
		background: var(--field-raised);
		color: var(--ink);
		border: 1px solid var(--hairline);
		padding: 8px 10px;
		font-family: var(--font-body);
		min-height: var(--tap);
	}
	select:focus {
		border-color: var(--blaze);
		outline: none;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		padding: 8px 12px;
		cursor: pointer;
		text-transform: capitalize;
	}
	.chip:hover {
		color: var(--ink);
	}
	.chip.on {
		background: var(--blaze);
		border-color: var(--blaze);
		color: var(--on-blaze);
	}
	.purpose {
		margin: 26px 0;
	}
	.phead {
		font-size: 1.5rem;
		border-bottom: 2px solid var(--blaze);
		padding-bottom: 5px;
		margin-bottom: 10px;
	}
	:global([data-mode='paper']) .phead {
		border-bottom-color: var(--ink);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.prow {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--tap);
		padding: 13px 16px;
		border: 1px solid var(--hairline);
		margin-top: -1px;
	}
	.prow:hover {
		border-color: var(--ink);
	}
	.prow.active {
		border-left: 3px solid var(--blaze);
	}
	.ptitle {
		font-size: 1.3rem;
	}
	.pmeta {
		margin-left: auto;
		text-align: right;
	}
	.badge {
		color: var(--blaze);
		margin-right: 6px;
	}
	.arrow {
		font-family: var(--font-display);
		font-size: 1.3rem;
	}
	.history {
		list-style: none;
		margin: 0 0 0 16px;
		padding: 0;
		border-left: 1px solid var(--hairline);
	}
	.vrow {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		font-size: 0.9rem;
	}
	.vrow:hover .vtitle {
		color: var(--blaze);
	}
	.vtitle {
		margin-right: auto;
	}
</style>
