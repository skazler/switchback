<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Notes · Switchback</title>
</svelte:head>

<p class="microlabel">Reference</p>
<h1 class="display">Notes on training</h1>

<div class="prose">{@html data.html}</div>

<style>
	h1 {
		margin-bottom: 18px;
	}
	.prose :global(h2) {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 600;
		margin: 26px 0 8px;
		padding-bottom: 5px;
		border-bottom: 2px solid var(--blaze);
	}
	:global([data-mode='paper']) .prose :global(h2) {
		border-bottom-color: var(--ink);
	}
	.prose :global(ul) {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.prose :global(li) {
		border-top: 0.5px solid var(--hairline);
		padding: 9px 0;
		line-height: 1.4;
	}
	.prose :global(strong) {
		color: var(--ink);
		font-weight: 600;
	}
	.prose :global(p) {
		color: var(--muted);
		margin: 8px 0;
	}
</style>
