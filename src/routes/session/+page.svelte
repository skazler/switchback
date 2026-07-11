<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { ulid } from '$lib/client/ulid';
	import { restSeconds, clock } from '$lib/client/session';
	import { activeSession, setsForSession, putSession, putSet, lastSetFor, type LocalSession, type LocalSet, type PlannedExercise } from '$lib/client/idb';
	import { syncNow, refreshPending } from '$lib/client/sync.svelte';

	let session = $state<LocalSession | null>(null);
	let loaded = $state(false);
	let sets = $state<LocalSet[]>([]);
	let activeKey = $state<string>('');
	let now = $state(Date.now());

	// weight/reps entry for the active exercise
	let weight = $state('');
	let reps = $state('');

	// rest timer
	let restEndsAt = $state<number | null>(null);

	const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	const keyOf = (p: PlannedExercise) => p.exercise_id || `x-${slug(p.name)}`;

	const planned = $derived(session?.planned ?? []);
	const activeExercise = $derived(planned.find((p) => keyOf(p) === activeKey));
	const setsByKey = $derived.by(() => {
		const m = new Map<string, LocalSet[]>();
		for (const s of sets) m.set(s.exercise_id, [...(m.get(s.exercise_id) ?? []), s]);
		return m;
	});
	const elapsed = $derived(session ? (now - new Date(session.started_at).getTime()) / 1000 : 0);
	const restLeft = $derived(restEndsAt ? (restEndsAt - now) / 1000 : 0);
	const resting = $derived(restEndsAt != null && restLeft > 0);

	let tick: ReturnType<typeof setInterval>;
	onMount(async () => {
		const s = await activeSession();
		if (s) {
			session = s;
			sets = await setsForSession(s.id);
			activeKey = planned.length ? keyOf(planned[0]) : '';
			await prefill();
		}
		loaded = true;
		tick = setInterval(() => (now = Date.now()), 1000);
	});
	onDestroy(() => clearInterval(tick));

	async function prefill() {
		if (!activeExercise) return;
		const last = await lastSetFor(keyOf(activeExercise));
		weight = last?.weight != null ? String(last.weight) : '';
		reps = last?.reps != null ? String(last.reps) : (activeExercise.reps ?? '').replace(/[^0-9].*$/, '');
	}

	async function selectExercise(p: PlannedExercise) {
		activeKey = keyOf(p);
		restEndsAt = null;
		await prefill();
	}

	async function logSet() {
		if (!session || !activeExercise) return;
		const key = keyOf(activeExercise);
		const done = setsByKey.get(key)?.length ?? 0;
		const set: LocalSet = {
			id: ulid(),
			session_id: session.id,
			exercise_id: key,
			set_num: done + 1,
			reps: reps ? Number(reps) : undefined,
			weight: weight ? Number(weight) : undefined,
			unit: 'lb',
			logged_at: new Date().toISOString(),
			synced: 0
		};
		await putSet(set);
		sets = await setsForSession(session.id);
		const rest = restSeconds(activeExercise.rest);
		restEndsAt = rest > 0 ? Date.now() + rest * 1000 : null;
		refreshPending();
		syncNow(); // fire-and-forget; no-op offline / for guests
	}

	async function complete() {
		if (!session) return;
		const updated = { ...session, completed_at: new Date().toISOString(), synced: 0 as const };
		await putSession(updated);
		session = updated;
		await syncNow();
		await goto('/log');
	}
</script>

<svelte:head><title>Session · Switchback</title></svelte:head>

{#if !loaded}
	<p class="muted">Loading…</p>
{:else if !session}
	<p class="microlabel">Session</p>
	<h1 class="display">No active session</h1>
	<div class="empty">
		<p>Nothing in progress. Start one from today's route.</p>
		<a class="btn-ghost" href="/route">Go to the route →</a>
	</div>
{:else}
	<header class="head">
		<p class="microlabel">{session.day} · {session.program_id}</p>
	</header>

	<!-- clock strip -->
	<div class="strip">
		<div class="clock rest" class:lit={resting} class:flash={restEndsAt != null && restLeft <= 0}>
			<span class="lbl">rest</span>
			<span class="num">{restEndsAt != null ? clock(Math.max(0, restLeft)) : '—'}</span>
		</div>
		<div class="clock sess">
			<span class="lbl">session</span>
			<span class="num">{clock(elapsed)}</span>
		</div>
	</div>

	<!-- exercises -->
	<ul class="ex-list">
		{#each planned as p (keyOf(p))}
			{@const key = keyOf(p)}
			{@const done = setsByKey.get(key) ?? []}
			<li class="ex" class:active={key === activeKey}>
				<button class="ex-head" onclick={() => selectExercise(p)}>
					<div class="ex-name">
						{#if p.group}<span class="grp microlabel">{p.group}</span>{/if}
						<span class="nm">{p.name}</span>
					</div>
					<div class="presc microlabel">
						{[p.sets && `${p.sets}×`, p.reps, p.rest && `rest ${p.rest}`].filter(Boolean).join(' · ')}
					</div>
				</button>
				{#if done.length}
					<div class="pips">
						{#each done as d (d.id)}
							<span class="pip">{d.weight ?? '–'}<small>×{d.reps ?? '–'}</small></span>
						{/each}
					</div>
				{/if}

				{#if key === activeKey}
					<div class="entry">
						<label>weight<input inputmode="decimal" bind:value={weight} /></label>
						<span class="x">×</span>
						<label>reps<input inputmode="numeric" bind:value={reps} /></label>
						<button class="log" onclick={logSet}>Log set</button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<button class="complete" onclick={complete}>Complete session</button>
{/if}

<style>
	.head {
		margin-bottom: 10px;
	}
	.empty {
		border-left: 3px solid var(--hairline);
		padding: 16px 20px;
		background: var(--field-raised);
	}
	.empty p {
		margin: 0 0 10px;
	}
	.strip {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin: 6px 0 22px;
	}
	.clock {
		border: 1px solid var(--hairline);
		padding: 10px 14px;
		display: flex;
		flex-direction: column;
	}
	.clock .lbl {
		font-family: var(--font-body);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.clock .num {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 2.4rem;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
	}
	.clock.rest.lit .num {
		color: var(--blaze-lit, var(--blaze));
	}
	.clock.flash {
		animation: flash 0.6s steps(2, start) 3;
	}
	@keyframes flash {
		50% {
			background: var(--blaze);
		}
	}
	.ex-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ex {
		border-left: 3px solid var(--hairline);
		background: var(--field-raised);
		padding: 4px 0;
	}
	.ex.active {
		border-left-color: var(--blaze);
	}
	.ex-head {
		width: 100%;
		background: none;
		border: none;
		color: inherit;
		text-align: left;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		padding: 10px 14px;
		cursor: pointer;
	}
	.grp {
		color: var(--muted);
		margin-right: 8px;
	}
	.nm {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: 1.15rem;
		text-transform: capitalize;
	}
	.presc {
		color: var(--muted);
		white-space: nowrap;
	}
	.pips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 14px 10px;
	}
	.pip {
		background: var(--blaze);
		color: var(--field);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		padding: 3px 8px;
		font-variant-numeric: tabular-nums;
	}
	.pip small {
		font-weight: 500;
		opacity: 0.85;
	}
	.entry {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		padding: 4px 14px 14px;
	}
	.entry label {
		display: flex;
		flex-direction: column;
		font-family: var(--font-body);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
		gap: 4px;
	}
	.entry input {
		width: 5.5ch;
		background: var(--field);
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.6rem;
		text-align: center;
		padding: 6px;
		font-variant-numeric: tabular-nums;
	}
	.entry .x {
		font-family: var(--font-display);
		color: var(--muted);
		padding-bottom: 8px;
	}
	.log {
		margin-left: auto;
		background: var(--blaze);
		color: var(--field);
		border: none;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		padding: 10px 16px;
		cursor: pointer;
	}
	.complete {
		margin-top: 26px;
		width: 100%;
		background: none;
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		letter-spacing: 0.04em;
		padding: 14px;
		cursor: pointer;
	}
	.complete:hover {
		border-color: var(--blaze);
		color: var(--blaze);
	}
</style>
