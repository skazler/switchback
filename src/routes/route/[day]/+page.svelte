<script lang="ts">
	import SessionTable from '$lib/components/SessionTable.svelte';
	import TrailMarker from '$lib/components/TrailMarker.svelte';
	import { goto } from '$app/navigation';
	import { startSession } from '$lib/client/session';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const day = $derived(data.day);
	const program = $derived(data.program);
	const week = $derived(data.week);
	const isToday = $derived(data.isToday);

	let starting = $state(false);
	async function start() {
		starting = true;
		try {
			await startSession(program.id, day.label, day.rows);
			await goto('/session');
		} finally {
			starting = false;
		}
	}
</script>

<svelte:head>
	<title>{day.label} · {program.title} · Switchback</title>
</svelte:head>

<article class="session">
	<header class="head">
		<p class="microlabel">
			{day.code} · {program.title}{week != null ? ` · week ${week}` : ''}{isToday ? ' · today' : ''}
		</p>
		<div class="titleline">
			<h1 class="display">{day.label}</h1>
			<TrailMarker marker={day.marker} size={24} />
		</div>
	</header>

	<hr class="rule" />

	{#if day.rows.length > 0}
		<SessionTable {day} />
		<button class="start" onclick={start} disabled={starting}>
			{starting ? 'Starting…' : 'Start session ▸'}
		</button>
	{:else}
		<p class="muted empty">No prescription recorded for this day.</p>
	{/if}

	<hr class="hairline foot" />
	<div class="footrow">
		<a class="back microlabel" href="/route">← Full route</a>
		<span class="microlabel muted">Logs stay on this device until synced</span>
	</div>
</article>

<style>
	.head {
		margin-bottom: 12px;
	}
	.titleline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-top: 4px;
	}
	.titleline h1 {
		font-size: clamp(2.2rem, 9vw, 3.4rem);
		text-transform: capitalize;
	}
	.empty {
		padding: 20px 0;
	}
	.start {
		margin-top: 22px;
		width: 100%;
		background: var(--blaze);
		color: var(--field);
		border: none;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.15rem;
		letter-spacing: 0.04em;
		padding: 15px;
		cursor: pointer;
	}
	.start:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.foot {
		margin-top: 28px;
	}
	.footrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 12px;
		gap: 12px;
	}
	.back:hover {
		color: var(--blaze);
	}
</style>
