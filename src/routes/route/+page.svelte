<script lang="ts">
	import ProgramView from '$lib/components/ProgramView.svelte';
	import { resolveToday } from '$lib/today';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Recompute today's week + highlighted day client-side (prerender would
	// otherwise freeze them at build time).
	let live = $state<ReturnType<typeof resolveToday> | null>(null);
	$effect(() => {
		live = resolveToday(data.program, new Date());
	});
	const currentWeek = $derived(
		live ? (live.status === 'no-program' || live.week === 0 ? null : live.week) : data.currentWeek
	);
	const todaySlug = $derived(
		live ? (live.status === 'session' ? live.day.slug : null) : data.todaySlug
	);
</script>

<svelte:head>
	<title>{data.program.title} · Switchback</title>
</svelte:head>

<ProgramView program={data.program} mode="active" {currentWeek} open={data.open} {todaySlug} />
