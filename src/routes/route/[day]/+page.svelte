<script lang="ts">
	import { onMount } from 'svelte';
	import SessionTable from '$lib/components/SessionTable.svelte';
	import TrailMarker from '$lib/components/TrailMarker.svelte';
	import { goto } from '$app/navigation';
	import { startSession, today } from '$lib/client/session';
	import { allSessions, setsForSession, type LocalSession, type LocalSet } from '$lib/client/idb';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const day = $derived(data.day);
	const program = $derived(data.program);
	const week = $derived(data.week);
	const isToday = $derived(data.isToday);

	// Detect a session already started/logged for this day today.
	let existing = $state<LocalSession | null>(null);
	let existingSets = $state<LocalSet[]>([]);
	onMount(refreshExisting);
	async function refreshExisting() {
		try {
			const all = (await allSessions()).filter((s) => s.day === day.label && s.date === today());
			all.sort((a, b) => b.started_at.localeCompare(a.started_at));
			existing = all[0] ?? null;
			existingSets = existing ? await setsForSession(existing.id) : [];
		} catch {
			existing = null;
		}
	}

	function tok(s: LocalSet): string {
		if (s.grade) return `${s.grade}${s.notes === 'sent' ? ' sent' : ''}`;
		if (s.distance != null || (s.duration_s != null && s.weight == null && s.reps == null))
			return [s.duration_s != null ? `${Math.round(s.duration_s / 60)}m` : '', s.distance != null ? `${s.distance}mi` : ''].filter(Boolean).join(' ');
		if (s.weight != null && s.reps != null) return `${s.weight}${s.unit ?? 'lb'} x ${s.reps}`;
		return s.reps != null ? `${s.reps} reps` : 'logged';
	}
	const logged = $derived.by(() => {
		const m = new Map<string, LocalSet[]>();
		for (const s of existingSets) m.set(s.exercise_id, [...(m.get(s.exercise_id) ?? []), s]);
		return [...m.values()];
	});

	let starting = $state(false);
	async function start() {
		starting = true;
		try {
			const id = await startSession(program.id, day.label, day.rows);
			await goto(`/session?id=${id}`);
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

		{#if existing}
			<div class="loggedcard">
				<p class="microlabel done">{existing.completed_at ? '✓ Logged today' : 'In progress · today'}</p>
				{#if logged.length}
					<ul class="loglist">
						{#each logged as g}
							<li><span class="lname">{g[0].exercise_id.replace(/^x-/, '').replace(/-/g, ' ')}</span><span class="ltok">{g.map(tok).join('  ')}</span></li>
						{/each}
					</ul>
				{:else}
					<p class="muted">No sets recorded yet.</p>
				{/if}
				{#if existing.completed_at}
					<button class="start again" onclick={start} disabled={starting}>{starting ? '…' : 'Log another session'}</button>
				{:else}
					<button class="start" onclick={() => goto(`/session?id=${existing!.id}`)}>Resume session →</button>
				{/if}
			</div>
		{:else}
			<button class="start" onclick={start} disabled={starting}>
				{starting ? 'Starting…' : 'Start session ▸'}
			</button>
		{/if}
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
	.loggedcard {
		margin-top: 22px;
		border-left: 3px solid var(--blaze);
		background: var(--field-raised);
		padding: 14px 16px;
	}
	.done {
		color: var(--blaze);
		margin: 0 0 10px;
	}
	.loglist {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
	}
	.loglist li {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		padding: 3px 0;
		align-items: baseline;
	}
	.lname {
		text-transform: capitalize;
	}
	.ltok {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.again {
		margin-top: 0;
		background: none;
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-size: 1rem;
	}
	.again:hover {
		border-color: var(--blaze);
		color: var(--blaze);
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
