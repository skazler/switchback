<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ulid } from '$lib/client/ulid';
	import { inferFormat } from '$lib/client/session';
	import {
		activeSession,
		getSession,
		setsForSession,
		putSession,
		putSet,
		lastSetFor,
		type LocalSession,
		type LocalSet,
		type PlannedExercise,
		type LogFormat
	} from '$lib/client/idb';
	import { syncNow, refreshPending, removeSet } from '$lib/client/sync.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let session = $state<LocalSession | null>(null);
	let loaded = $state(false);
	let sets = $state<LocalSet[]>([]);
	let activeKey = $state('');
	let selectedWeek = $state('');
	let fmtOverride = $state<Record<string, LogFormat>>({});

	// entry inputs (only the ones the active format needs are shown)
	let weight = $state('');
	let reps = $state('');
	let minutes = $state('');
	let distance = $state('');
	let grade = $state('');
	let sent = $state(true);
	let showFormats = $state(false);
	let sessionNotes = $state('');
	let addingExercise = $state(false);
	let newExName = $state('');

	const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	const keyOf = (p: PlannedExercise) => p.exercise_id || `x-${slug(p.name)}`;

	const planned = $derived(session?.planned ?? []);
	const weeks = $derived([...new Set(planned.map((p) => p.week).filter(Boolean))] as string[]);
	const visible = $derived(planned.filter((p) => !p.week || !weeks.length || p.week === selectedWeek));
	const activeExercise = $derived(visible.find((p) => keyOf(p) === activeKey) ?? visible[0]);
	const activeFmt = $derived<LogFormat>(activeExercise ? (fmtOverride[keyOf(activeExercise)] ?? activeExercise.format ?? 'strength') : 'strength');

	const setsByKey = $derived.by(() => {
		const m = new Map<string, LocalSet[]>();
		for (const s of sets) m.set(s.exercise_id, [...(m.get(s.exercise_id) ?? []), s]);
		return m;
	});

	onMount(async () => {
		const id = page.url.searchParams.get('id');
		const s = (id ? await getSession(id) : null) ?? (await activeSession());
		if (s) {
			session = s;
			sets = await setsForSession(s.id);
			const wk = [...new Set((s.planned ?? []).map((p) => p.week).filter(Boolean))] as string[];
			selectedWeek = wk[0] ?? '';
			const first = (s.planned ?? []).find((p) => !p.week || p.week === selectedWeek);
			if (first) activeKey = keyOf(first);
			sessionNotes = s.notes ?? '';
			await prefill();
		}
		loaded = true;
	});

	async function prefill() {
		[weight, reps, minutes, distance, grade] = ['', '', '', '', ''];
		sent = true;
		if (!activeExercise) return;
		const last = await lastSetFor(keyOf(activeExercise));
		if (last) {
			if (last.weight != null) weight = String(last.weight);
			if (last.reps != null) reps = String(last.reps);
			if (last.duration_s != null) minutes = String(Math.round(last.duration_s / 60));
			if (last.distance != null) distance = String(last.distance);
			if (last.grade) grade = last.grade;
		}
		if (!reps) reps = (activeExercise.reps ?? '').replace(/[^0-9].*$/, '');
	}

	async function selectExercise(p: PlannedExercise) {
		activeKey = keyOf(p);
		showFormats = false;
		await prefill();
	}

	function setFormat(f: LogFormat) {
		if (activeExercise) fmtOverride = { ...fmtOverride, [keyOf(activeExercise)]: f };
		showFormats = false;
	}

	async function logSet() {
		if (!session || !activeExercise) return;
		const key = keyOf(activeExercise);
		const done = setsByKey.get(key)?.length ?? 0;
		const s: LocalSet = { id: ulid(), session_id: session.id, exercise_id: key, set_num: done + 1, logged_at: new Date().toISOString(), synced: 0 };
		if (activeFmt === 'strength') {
			if (weight) s.weight = Number(weight);
			if (reps) s.reps = Number(reps);
			s.unit = 'lb';
		} else if (activeFmt === 'ride') {
			if (minutes) s.duration_s = Math.round(Number(minutes) * 60);
			if (distance) s.distance = Number(distance);
		} else if (activeFmt === 'climb') {
			if (grade) s.grade = /^v/i.test(grade) ? grade.toUpperCase() : `V${grade}`;
			s.notes = sent ? 'sent' : 'attempt';
		} else if (activeFmt === 'time') {
			if (minutes) s.duration_s = Math.round(Number(minutes) * 60);
		}
		await putSet(s);
		sets = await setsForSession(session.id);
		refreshPending();
		syncNow();
	}

	async function addExercise() {
		if (!session) return;
		const name = newExName.trim();
		if (!name) return;
		const match = data.library.find((e) => e.name.toLowerCase() === name.toLowerCase());
		const p: PlannedExercise = {
			exercise_id: match?.id ?? '',
			name: match?.name ?? name,
			format: inferFormat(match?.name ?? name, session.day ?? ''),
			extra: true
		};
		const snap = $state.snapshot(session);
		const updated = { ...snap, planned: [...snap.planned, p], synced: 0 as const };
		await putSession(updated);
		session = updated;
		newExName = '';
		addingExercise = false;
		activeKey = keyOf(p);
		await prefill();
	}

	async function del(id: string) {
		await removeSet(id);
		if (session) sets = await setsForSession(session.id);
	}

	async function saveNotes() {
		if (!session) return;
		const updated = { ...$state.snapshot(session), notes: sessionNotes.trim() || undefined, synced: 0 as const };
		await putSession(updated);
		session = updated;
		syncNow();
	}

	function pip(s: LocalSet): string {
		if (s.grade) return `${s.grade}${s.notes === 'sent' ? ' sent' : ''}`;
		if (s.distance != null || (s.duration_s != null && s.weight == null && s.reps == null)) {
			const parts = [];
			if (s.duration_s != null) parts.push(`${Math.round(s.duration_s / 60)}m`);
			if (s.distance != null) parts.push(`${s.distance}mi`);
			return parts.join(' ') || 'done';
		}
		if (s.weight != null) return `${s.weight}${s.unit ?? 'lb'} x ${s.reps ?? '–'}`;
		return `${s.reps ?? '–'} reps`;
	}

	let completing = $state(false);
	let completeError = $state('');
	async function complete() {
		if (completing) return;
		completing = true;
		completeError = '';
		try {
			if (!session) {
				completeError = 'No session loaded — try reopening this session from the route page.';
				return;
			}
			const updated = { ...$state.snapshot(session), completed_at: new Date().toISOString(), notes: sessionNotes.trim() || undefined, synced: 0 as const };
			await putSession(updated);
			session = updated;
			// Fire-and-forget: /log's merge prefers this unsynced local copy over a
			// stale D1 row anyway, so navigation must never wait on the network —
			// a hung/slow fetch here would otherwise block goto() indefinitely.
			syncNow();
			await goto('/log');
		} catch (e) {
			completeError = e instanceof Error ? e.message : 'Complete failed — unknown error.';
		} finally {
			completing = false;
		}
	}

	const FORMATS: { id: LogFormat; label: string }[] = [
		{ id: 'strength', label: 'Weights' },
		{ id: 'ride', label: 'Ride' },
		{ id: 'climb', label: 'Climb' },
		{ id: 'time', label: 'Time' }
	];
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

	{#if weeks.length > 1}
		<div class="weeks">
			{#each weeks as w}
				<button class="wk" class:on={selectedWeek === w} onclick={() => (selectedWeek = w)}>Week {w}</button>
			{/each}
		</div>
	{/if}

	<ul class="ex-list">
		{#each visible as p (keyOf(p))}
			{@const key = keyOf(p)}
			{@const done = setsByKey.get(key) ?? []}
			<li class="ex" class:active={key === activeKey}>
				<button class="ex-head" onclick={() => selectExercise(p)}>
					<div class="ex-name">
						{#if p.extra}<span class="grp microlabel extra">extra</span>{:else if p.group}<span class="grp microlabel">{p.group}</span>{/if}
						<span class="nm">{p.name}</span>
					</div>
					<div class="presc microlabel">{[p.sets && `${p.sets}×`, p.reps].filter(Boolean).join(' ')}</div>
				</button>

				{#if done.length}
					<div class="pips">
						{#each done as d (d.id)}
							<span class="pip">{pip(d)}<button class="x" aria-label="Delete" onclick={() => del(d.id)}>×</button></span>
						{/each}
					</div>
				{/if}

				{#if key === activeKey}
					<div class="entry">
						<div class="fields">
							{#if activeFmt === 'strength'}
								<label>weight<input inputmode="decimal" bind:value={weight} /></label>
								<span class="x2">×</span>
								<label>reps<input inputmode="numeric" bind:value={reps} /></label>
							{:else if activeFmt === 'ride'}
								<label>min<input inputmode="decimal" bind:value={minutes} /></label>
								<label>miles<input inputmode="decimal" bind:value={distance} /></label>
							{:else if activeFmt === 'climb'}
								<label>grade<input class="grade" bind:value={grade} placeholder="V4" /></label>
								<button class="sent" class:on={sent} onclick={() => (sent = !sent)}>{sent ? '✓ sent' : 'attempt'}</button>
							{:else}
								<label>min<input inputmode="decimal" bind:value={minutes} /></label>
							{/if}
							<button class="log" onclick={logSet}>Log</button>
						</div>
						<button class="fmt-toggle microlabel" onclick={() => (showFormats = !showFormats)}>
							{FORMATS.find((f) => f.id === activeFmt)?.label ?? activeFmt} ▾
						</button>
						{#if showFormats}
							<div class="fmts">
								{#each FORMATS as f}
									<button class="fmt" class:on={activeFmt === f.id} onclick={() => setFormat(f.id)}>{f.label}</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if addingExercise}
		<div class="addex">
			<input
				class="addex-input"
				list="library-options"
				bind:value={newExName}
				placeholder="Exercise name…"
				onkeydown={(e) => e.key === 'Enter' && addExercise()}
			/>
			<datalist id="library-options">
				{#each data.library as e}<option value={e.name}></option>{/each}
			</datalist>
			<button class="addex-go" onclick={addExercise}>Add</button>
			<button class="btn-ghost" onclick={() => ((addingExercise = false), (newExName = ''))}>Cancel</button>
		</div>
	{:else}
		<button class="add-ex" onclick={() => (addingExercise = true)}>+ Add exercise not on plan</button>
	{/if}

	<label class="notes-field">
		<span class="microlabel">Session notes</span>
		<textarea bind:value={sessionNotes} onblur={saveNotes} placeholder="How'd it go? Anything to remember…"></textarea>
	</label>

	{#if completeError}<p class="completeerr">{completeError}</p>{/if}
	<button class="complete" onclick={complete} disabled={completing}>{completing ? 'Completing…' : 'Complete session'}</button>
{/if}

<style>
	.head {
		margin-bottom: 14px;
	}
	.empty {
		border-left: 3px solid var(--hairline);
		padding: 16px 20px;
		background: var(--field-raised);
	}
	.empty p {
		margin: 0 0 10px;
	}
	.weeks {
		display: flex;
		gap: 6px;
		margin-bottom: 16px;
	}
	.wk {
		flex: 1;
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1rem;
		letter-spacing: 0.04em;
		padding: 11px;
		cursor: pointer;
	}
	.wk.on {
		background: var(--blaze);
		border-color: var(--blaze);
		color: var(--on-blaze, var(--field));
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
	.grp.extra {
		color: var(--blaze);
	}
	.add-ex {
		margin-top: 10px;
		width: 100%;
		background: none;
		border: 1px dashed var(--hairline);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 10px;
		cursor: pointer;
	}
	.add-ex:hover {
		border-color: var(--blaze);
		color: var(--blaze);
	}
	.addex {
		margin-top: 10px;
		display: flex;
		gap: 8px;
	}
	.addex-input {
		flex: 1;
		background: var(--field);
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.95rem;
		padding: 10px 12px;
	}
	.addex-input:focus {
		border-color: var(--blaze);
		outline: none;
	}
	.addex-go {
		background: var(--blaze);
		color: var(--field);
		border: none;
		font-family: var(--font-display);
		font-weight: 600;
		padding: 0 16px;
		cursor: pointer;
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
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--blaze);
		color: var(--field);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		padding: 3px 4px 3px 8px;
		font-variant-numeric: tabular-nums;
	}
	.pip .x {
		background: none;
		border: none;
		color: var(--field);
		opacity: 0.7;
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 3px;
	}
	.pip .x:hover {
		opacity: 1;
	}
	.entry {
		padding: 2px 14px 14px;
	}
	.fmt-toggle {
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		padding: 8px 0 0;
		text-transform: capitalize;
	}
	.fmt-toggle:hover {
		color: var(--blaze);
	}
	.fmts {
		display: flex;
		gap: 4px;
		margin-top: 8px;
	}
	.fmt {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 5px 9px;
		cursor: pointer;
	}
	.fmt.on {
		border-color: var(--blaze);
		color: var(--blaze);
	}
	.fields {
		display: flex;
		align-items: flex-end;
		gap: 10px;
	}
	.fields label {
		display: flex;
		flex-direction: column;
		font-family: var(--font-body);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
		gap: 4px;
	}
	.fields input {
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
	.fields input.grade {
		width: 4ch;
		text-transform: uppercase;
	}
	.x2 {
		font-family: var(--font-display);
		color: var(--muted);
		padding-bottom: 8px;
	}
	.sent {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 8px 10px;
		cursor: pointer;
	}
	.sent.on {
		border-color: var(--blaze);
		color: var(--blaze);
	}
	.log {
		margin-left: auto;
		background: var(--blaze);
		color: var(--field);
		border: none;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		padding: 10px 18px;
		cursor: pointer;
	}
	.notes-field {
		display: block;
		margin-top: 24px;
	}
	.notes-field textarea {
		display: block;
		width: 100%;
		margin-top: 6px;
		min-height: 72px;
		background: var(--field-raised);
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.95rem;
		padding: 10px 12px;
		resize: vertical;
		box-sizing: border-box;
	}
	.notes-field textarea:focus {
		border-color: var(--blaze);
		outline: none;
	}
	.completeerr {
		margin: 16px 0 0;
		color: var(--blaze);
		font-size: 0.9rem;
	}
	.complete {
		margin-top: 16px;
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
	.complete:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.complete:hover {
		border-color: var(--blaze);
		color: var(--blaze);
	}
</style>
