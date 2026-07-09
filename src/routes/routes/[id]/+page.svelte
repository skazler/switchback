<script lang="ts">
	import ProgramView from '$lib/components/ProgramView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const mode = $derived(data.program.status === 'active' ? 'active' : 'archived');
</script>

<svelte:head>
	<title>{data.program.title} · Switchback</title>
</svelte:head>

<p class="back"><a class="microlabel" href="/routes">← All programs</a></p>
<ProgramView program={data.program} {mode} />

<style>
	.back {
		margin: 0 0 10px;
	}
	.back a:hover {
		color: var(--blaze);
	}
</style>
