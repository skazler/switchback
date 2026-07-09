<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Programs · Switchback</title>
</svelte:head>

<p class="microlabel">All programs</p>
<h1 class="display">Routes</h1>

<ol class="list">
	{#each data.programs as p}
		<li>
			<a class="prow" class:active={p.status === 'active'} href={p.status === 'active' ? '/route' : `/routes/${p.id}`}>
				<span class="ptitle display">{p.title}</span>
				<span class="pmeta microlabel">
					{p.status === 'active' ? 'active' : 'archived'} · {p.days} days
				</span>
				<span class="arrow" aria-hidden="true">→</span>
			</a>
		</li>
	{/each}
</ol>

<style>
	h1 {
		margin-bottom: 18px;
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
		padding: 14px 16px;
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
		font-size: 1.4rem;
	}
	.pmeta {
		margin-left: auto;
	}
	.arrow {
		font-family: var(--font-display);
		font-size: 1.3rem;
	}
</style>
