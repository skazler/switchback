<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ulid } from '$lib/client/ulid';
	import { inferFormat, buildPlanned } from '$lib/client/session';
	import { blockLabels, isChoice } from '$lib/session-display';
	import ExercisePicker from '$lib/components/ExercisePicker.svelte';
	import { durationInputValue, formatDistance, formatDuration, parseDistance, parseDuration } from '$lib/set-input';
	import { resolveToday, resolvePlan } from '$lib/today';
	import type { ProgramDay } from '$lib/content/types';
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
	let duration = $state('');
	let distance = $state('');
	let grade = $state('');
	let entryError = $state('');
	let sent = $state(true);
	let showFormats = $state(false);
	let sessionNotes = $state('');
	let sessionDate = $state('');
	let planSuggestion = $state<{ day: ProgramDay; week: number } | null>(null);
	/** which block the "add exercise" picker is open for: a group label, or
	 *  '' for the ungrouped tail. null = closed. */
	let addingTo = $state<string | null>(null);
	/** key of the "… choice" row whose picker is open, '' if none */
	let pickingKey = $state('');
	/** key of the row whose delete is waiting on a confirm (it has sets) */
	let confirmDeleteKey = $state('');

	const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	const keyOf = (p: PlannedExercise) => p.exercise_id || `x-${slug(p.name)}`;

	const planned = $derived(session?.planned ?? []);
	const weeks = $derived([...new Set(planned.map((p) => p.week).filter(Boolean))] as string[]);
	const visible = $derived(planned.filter((p) => !p.week || !weeks.length || p.week === selectedWeek));
	const activeExercise = $derived(visible.find((p) => keyOf(p) === activeKey) ?? visible[0]);
	const activeFmt = $derived<LogFormat>(activeExercise ? (fmtOverride[keyOf(activeExercise)] ?? activeExercise.format ?? 'strength') : 'strength');

	/** Block label per planned row, blanks carried forward (session-display). */
	const blockOf = $derived(blockLabels(planned));

	// Rows render under one band per block, which also gives each circuit
	// somewhere to hang its own "add" button.
	const sections = $derived.by(() => {
		const out: { group: string; items: PlannedExercise[] }[] = [];
		planned.forEach((p, i) => {
			if (p.week && weeks.length && p.week !== selectedWeek) return;
			const g = blockOf[i];
			const last = out[out.length - 1];
			if (last && last.group === g) last.items.push(p);
			else out.push({ group: g, items: [p] });
		});
		return out;
	});

	const setsByKey = $derived.by(() => {
		const m = new Map<string, LocalSet[]>();
		for (const s of sets) m.set(s.exercise_id, [...(m.get(s.exercise_id) ?? []), s]);
		return m;
	});

	interface RemoteSet {
		id: string;
		exercise_id: string;
		set_num: number | null;
		reps: number | null;
		weight: number | null;
		unit: string | null;
		duration_s: number | null;
		distance: number | null;
		grade: string | null;
		notes?: string | null;
	}
	interface RemoteSession {
		id: string;
		date: string;
		program_id: string | null;
		day: string | null;
		started_at: string | null;
		completed_at: string | null;
		notes?: string | null;
		sets: RemoteSet[];
	}

	function formatFromSets(exSets: RemoteSet[]): LogFormat {
		if (exSets.some((s) => s.grade != null)) return 'climb';
		if (exSets.some((s) => s.distance != null)) return 'ride';
		if (exSets.some((s) => s.duration_s != null && s.weight == null && s.reps == null)) return 'time';
		return 'strength';
	}

	// Editing an old/other-device session works by opening it here like any
	// other — so a session with no local IndexedDB copy (D1-only history, or
	// synced from elsewhere) is adopted on first open: fetch it, synthesize a
	// `planned` list from its actual logged sets (there's no real prescription
	// to recover), and persist so the rest of the page treats it normally.
	async function adopt(id: string): Promise<LocalSession | undefined> {
		const res = await fetch(`/api/log?id=${id}`);
		if (!res.ok) return undefined;
		const j = (await res.json()) as { session: RemoteSession | null };
		if (!j.session) return undefined;
		const r = j.session;

		const byExercise = new Map<string, RemoteSet[]>();
		for (const x of r.sets) byExercise.set(x.exercise_id, [...(byExercise.get(x.exercise_id) ?? []), x]);
		const planned: PlannedExercise[] = [...byExercise.entries()].map(([exerciseId, exSets]) => ({
			exercise_id: exerciseId,
			name: data.library.find((e) => e.id === exerciseId)?.name ?? exerciseId.replace(/^x-/, '').replace(/-/g, ' '),
			format: formatFromSets(exSets),
			extra: true
		}));

		const localSession: LocalSession = {
			id: r.id,
			date: r.date,
			program_id: r.program_id ?? '',
			day: r.day ?? '',
			started_at: r.started_at ?? r.date,
			completed_at: r.completed_at ?? undefined,
			notes: r.notes ?? undefined,
			planned,
			synced: 1
		};
		await putSession(localSession);
		for (const x of r.sets) {
			const set: LocalSet = {
				id: x.id,
				session_id: r.id,
				exercise_id: x.exercise_id,
				set_num: x.set_num ?? undefined,
				reps: x.reps ?? undefined,
				weight: x.weight ?? undefined,
				unit: x.unit ?? undefined,
				duration_s: x.duration_s ?? undefined,
				distance: x.distance ?? undefined,
				grade: x.grade ?? undefined,
				notes: x.notes ?? undefined,
				logged_at: r.started_at ?? r.date,
				synced: 1
			};
			await putSet(set);
		}
		return localSession;
	}

	onMount(async () => {
		const id = page.url.searchParams.get('id');
		let s = (id ? await getSession(id) : null) ?? (await activeSession());
		if (!s && id) s = await adopt(id);
		if (s) {
			session = s;
			sets = await setsForSession(s.id);
			const wk = [...new Set((s.planned ?? []).map((p) => p.week).filter(Boolean))] as string[];
			selectedWeek = wk[0] ?? '';
			const first = (s.planned ?? []).find((p) => !p.week || p.week === selectedWeek);
			if (first) activeKey = keyOf(first);
			sessionNotes = s.notes ?? '';
			sessionDate = s.date;
			await prefill();
		}
		loaded = true;
	});

	async function prefill() {
		[weight, reps, duration, distance, grade] = ['', '', '', '', ''];
		sent = true;
		entryError = '';
		if (!activeExercise) return;
		const last = await lastSetFor(keyOf(activeExercise));
		if (last) {
			if (last.weight != null) weight = String(last.weight);
			if (last.reps != null) reps = String(last.reps);
			if (last.duration_s != null) duration = durationInputValue(last.duration_s);
			if (last.distance != null) distance = formatDistance(last.distance);
			if (last.grade) grade = last.grade;
		}
		if (!reps) reps = (activeExercise.reps ?? '').replace(/[^0-9].*$/, '');
		// A timed prescription ("30 min" on the warm-up bike) is a real
		// default, not a placeholder — put it in the field so it's one tap to
		// log and still editable when the ride ran long. Only when there's no
		// last-set value to carry forward, same rule as reps above.
		const fmt = fmtOverride[keyOf(activeExercise)] ?? activeExercise.format ?? 'strength';
		if (!duration && (fmt === 'ride' || fmt === 'time')) {
			const planned = parseDuration(activeExercise.reps ?? '');
			if (planned != null) duration = durationInputValue(planned);
		}
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
		entryError = '';
		if (activeFmt === 'strength') {
			if (weight) s.weight = Number(weight);
			if (reps) s.reps = Number(reps);
			s.unit = 'lb';
		} else if (activeFmt === 'ride' || activeFmt === 'time') {
			// A field that's filled but unreadable is a typo, not an empty set —
			// say so rather than logging a NaN that survives all the way to D1.
			if (duration) {
				const secs = parseDuration(duration);
				if (secs == null) {
					entryError = `Can't read "${duration}" as a time — try 45, 1:30, or 1h30m.`;
					return;
				}
				s.duration_s = secs;
			}
			if (activeFmt === 'ride' && distance) {
				const mi = parseDistance(distance);
				if (mi == null) {
					entryError = `Can't read "${distance}" as miles — try 12 or 12.4.`;
					return;
				}
				s.distance = mi;
			}
		} else if (activeFmt === 'climb') {
			if (grade) s.grade = /^v/i.test(grade) ? grade.toUpperCase() : `V${grade}`;
			s.notes = sent ? 'sent' : 'attempt';
		}
		await putSet(s);
		sets = await setsForSession(session.id);
		refreshPending();
		syncNow();
	}

	/**
	 * Add a move to the session. `group` places it inside that block — it
	 * lands after the block's last row rather than at the bottom of the
	 * screen, so a movement added to a circuit reads as part of the circuit.
	 */
	async function addExercise(choice: { name: string; entry?: { id: string } }, group = '') {
		if (!session) return;
		const p: PlannedExercise = {
			exercise_id: choice.entry?.id ?? '',
			name: choice.name,
			group: group || undefined,
			// Inherit the shown week, or a row added to Week A vanishes the
			// moment the toggle is on Week B.
			week: weeks.length ? selectedWeek : undefined,
			format: inferFormat(choice.name, session.day ?? ''),
			extra: true
		};
		const snap = $state.snapshot(session);
		const planned = [...snap.planned];
		let at = planned.length;
		if (group) {
			// End of the block as it *renders* — blockOf, not the raw Block
			// cell, or the row lands after the block's first line instead of
			// its last.
			const lastOfBlock = blockOf.findLastIndex((b) => b === group);
			if (lastOfBlock >= 0) at = lastOfBlock + 1;
		}
		planned.splice(at, 0, p);
		const updated = { ...snap, planned, synced: 0 as const };
		await putSession(updated);
		session = updated;
		addingTo = null;
		activeKey = keyOf(p);
		await prefill();
	}

	/**
	 * Drop a move from the session — a circuit movement you're skipping, a
	 * planned lift the rack was busy for, a mis-added extra. Sets already
	 * logged against it go too (they'd be unreachable otherwise), so that
	 * case takes a second tap to confirm. A key shared with another planned
	 * row keeps its sets: they belong to that row as much as this one.
	 */
	async function removeExercise(p: PlannedExercise) {
		if (!session) return;
		const at = planned.indexOf(p);
		if (at < 0) return;
		const key = keyOf(p);
		const logged = setsByKey.get(key) ?? [];
		if (logged.length && confirmDeleteKey !== key) {
			confirmDeleteKey = key;
			return;
		}
		const sharesKey = planned.some((x, i) => i !== at && keyOf(x) === key);
		if (!sharesKey) for (const d of logged) await removeSet(d.id);

		const snap = $state.snapshot(session);
		const remaining = snap.planned.filter((_, i) => i !== at);
		const updated = { ...snap, planned: remaining, synced: 0 as const };
		await putSession(updated);
		session = updated;
		sets = await setsForSession(updated.id);
		confirmDeleteKey = '';
		if (activeKey === key) {
			const next = remaining.find((x) => !x.week || !weeks.length || x.week === selectedWeek);
			activeKey = next ? keyOf(next) : '';
		}
		await prefill();
		syncNow();
	}

	/**
	 * Resolve a "… choice" row (ACCESSORY LIFT CHOICE, QUAD EXERCISE CHOICE)
	 * into the move you actually did. The prescription — group, sets, reps,
	 * rest — carries over; the row it satisfies is kept in `choiceFor` so the
	 * log still says what the plan asked for. Only offered before the first
	 * set is logged against the row, so nothing can be orphaned by a re-pick.
	 */
	async function chooseFor(target: PlannedExercise, choice: { name: string; entry?: { id: string } }) {
		if (!session) return;
		const oldKey = keyOf(target);
		const snap = $state.snapshot(session);
		const resolved: PlannedExercise = {
			...target,
			exercise_id: choice.entry?.id ?? '',
			name: choice.name,
			choiceFor: target.choiceFor ?? target.name,
			format: inferFormat(choice.name, session.day ?? '')
		};
		const updated = {
			...snap,
			planned: snap.planned.map((p) => (keyOf(p) === oldKey ? resolved : p)),
			synced: 0 as const
		};
		await putSession(updated);
		session = updated;
		pickingKey = '';
		activeKey = keyOf(resolved);
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

	// After a date edit, check whether the entered date actually falls on a
	// different program day than the one this session's exercises came from
	// (e.g. backdating a session logged under today's plan to yesterday,
	// which was a different day in the weekly rotation) — only then offer to
	// swap the plan in, so the common case (fixing a same-day timestamp) adds
	// no UI at all.
	function checkPlanMismatch() {
		planSuggestion = null;
		if (!session || !data.program) return;
		const [y, m, d] = session.date.split('-').map(Number);
		const resolved = resolveToday(data.program, new Date(y, m - 1, d, 12));
		if (resolved.status === 'session' && resolved.day.label !== session.day) {
			planSuggestion = { day: resolved.day, week: resolved.week };
		}
	}

	async function saveDate() {
		if (!session || !sessionDate || sessionDate === session.date) return;
		const updated = { ...$state.snapshot(session), date: sessionDate, synced: 0 as const };
		await putSession(updated);
		session = updated;
		checkPlanMismatch();
		syncNow();
	}

	// Re-snapshot planned exercises from the program day that actually
	// matches the session's date. Sets already logged against exercises not
	// in the new plan are kept, tagged "extra", so nothing is lost.
	async function swapPlan() {
		if (!session || !planSuggestion || !data.program) return;
		const resolvedRows = resolvePlan(planSuggestion.day, data.program, planSuggestion.week).rows;
		const newPlanned = buildPlanned(planSuggestion.day.label, resolvedRows);
		const newKeys = new Set(newPlanned.map(keyOf));
		const keepOld = session.planned
			.filter((p) => (setsByKey.get(keyOf(p))?.length ?? 0) > 0 && !newKeys.has(keyOf(p)))
			.map((p) => ({ ...p, extra: true }));
		const updated = { ...$state.snapshot(session), day: planSuggestion.day.label, planned: [...newPlanned, ...keepOld], synced: 0 as const };
		await putSession(updated);
		session = updated;
		const wk = [...new Set(updated.planned.map((p) => p.week).filter(Boolean))] as string[];
		selectedWeek = wk[0] ?? '';
		const first = updated.planned.find((p) => !p.week || p.week === selectedWeek);
		activeKey = first ? keyOf(first) : '';
		fmtOverride = {};
		planSuggestion = null;
		await prefill();
		syncNow();
	}

	function pip(s: LocalSet): string {
		if (s.grade) return `${s.grade}${s.notes === 'sent' ? ' sent' : ''}`;
		if (s.distance != null || (s.duration_s != null && s.weight == null && s.reps == null)) {
			const parts = [];
			if (s.duration_s != null) parts.push(formatDuration(s.duration_s));
			if (s.distance != null) parts.push(`${formatDistance(s.distance)}mi`);
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
		<input class="date-field" type="date" bind:value={sessionDate} onchange={saveDate} />
	</header>

	{#if planSuggestion}
		<div class="planhint">
			<span><strong>{planSuggestion.day.label}</strong> is the plan for this date.</span>
			<button class="swap" onclick={swapPlan}>Swap in →</button>
			<button class="dismiss" aria-label="Dismiss" onclick={() => (planSuggestion = null)}>×</button>
		</div>
	{/if}

	{#if weeks.length > 1}
		<div class="weeks">
			{#each weeks as w}
				<button class="wk" class:on={selectedWeek === w} onclick={() => (selectedWeek = w)}>Week {w}</button>
			{/each}
		</div>
	{/if}

	{#each sections as sec, si (`${si}/${sec.group}`)}
		{#if sec.group}<p class="blockband microlabel">{sec.group}</p>{/if}
		<ul class="ex-list">
			{#each sec.items as p (keyOf(p))}
				{@const key = keyOf(p)}
				{@const done = setsByKey.get(key) ?? []}
				<li class="ex" class:active={key === activeKey}>
					<div class="ex-head">
						<button class="ex-select" onclick={() => selectExercise(p)}>
							<div class="ex-name">
								{#if p.extra}<span class="grp microlabel extra">added</span>{/if}
								<span class="nm">{p.name}</span>
								{#if p.choiceFor}<span class="grp microlabel forchoice">for {p.choiceFor}</span>{/if}
							</div>
							<div class="presc microlabel">{[p.sets && `${p.sets}×`, p.reps].filter(Boolean).join(' ')}</div>
						</button>
						<button class="ex-del" aria-label="Remove {p.name}" onclick={() => removeExercise(p)}>×</button>
					</div>

					{#if confirmDeleteKey === key}
						<div class="confirmdel">
							<span>Remove this and its {done.length} logged set{done.length === 1 ? '' : 's'}?</span>
							<button class="del-yes" onclick={() => removeExercise(p)}>Remove</button>
							<button class="del-no" onclick={() => (confirmDeleteKey = '')}>Keep</button>
						</div>
					{/if}

					{#if isChoice(p.name) && !done.length}
						{#if pickingKey === key}
							<div class="pickwrap">
								<ExercisePicker
									library={data.library}
									placeholder="Search by name, category, body part…"
									onpick={(c) => chooseFor(p, c)}
									oncancel={() => (pickingKey = '')}
								/>
							</div>
						{:else}
							<button class="choose" onclick={() => (pickingKey = key)}>Choose from library →</button>
						{/if}
					{/if}

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
									<label>time<input inputmode="text" placeholder="1:30" bind:value={duration} /></label>
									<label>miles<input inputmode="decimal" placeholder="12.4" bind:value={distance} /></label>
								{:else if activeFmt === 'climb'}
									<label>grade<input class="grade" bind:value={grade} placeholder="V4" /></label>
									<button class="sent" class:on={sent} onclick={() => (sent = !sent)}>{sent ? '✓ sent' : 'attempt'}</button>
								{:else}
									<label>time<input inputmode="text" placeholder="45" bind:value={duration} /></label>
								{/if}
								<button class="log" onclick={logSet}>Log</button>
							</div>
							{#if entryError}<p class="entryerr">{entryError}</p>{/if}
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

		{#if sec.group}
			{#if addingTo === sec.group}
				<div class="addex">
					<ExercisePicker
						library={data.library}
						placeholder="Search by name, category, body part…"
						onpick={(c) => addExercise(c, sec.group)}
						oncancel={() => (addingTo = null)}
					/>
				</div>
			{:else}
				<button class="add-ex inblock" onclick={() => (addingTo = sec.group)}>
					+ Add to {sec.group}
				</button>
			{/if}
		{/if}
	{/each}

	{#if addingTo === ''}
		<div class="addex">
			<ExercisePicker
				library={data.library}
				placeholder="Search by name, category, body part…"
				onpick={(c) => addExercise(c)}
				oncancel={() => (addingTo = null)}
			/>
		</div>
	{:else}
		<button class="add-ex" onclick={() => (addingTo = '')}>+ Add exercise not on plan</button>
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
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.date-field {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 5px 8px;
	}
	.date-field:focus {
		border-color: var(--blaze);
		color: var(--ink);
		outline: none;
	}
	.empty {
		border-left: 3px solid var(--hairline);
		padding: 16px 20px;
		background: var(--field-raised);
	}
	.empty p {
		margin: 0 0 10px;
	}
	.planhint {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 14px;
		padding: 8px 10px;
		border-left: 3px solid var(--blaze);
		background: var(--field-raised);
		font-size: 0.85rem;
	}
	.planhint span {
		flex: 1;
	}
	.planhint strong {
		text-transform: capitalize;
	}
	.planhint .swap {
		background: none;
		border: none;
		color: var(--blaze);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		white-space: nowrap;
	}
	.planhint .dismiss {
		background: none;
		border: none;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0 0 0 4px;
	}
	.planhint .dismiss:hover {
		color: var(--blaze);
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
	.blockband {
		margin: 16px 0 6px;
		color: var(--blaze);
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
		display: flex;
		align-items: stretch;
	}
	.ex-select {
		flex: 1;
		min-width: 0;
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
	.ex-del {
		flex: 0 0 auto;
		width: var(--tap);
		background: none;
		border: none;
		color: var(--muted);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
	}
	.ex-del:hover {
		color: var(--blaze);
	}
	.confirmdel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 0 14px 10px;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.confirmdel button {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 6px 12px;
		cursor: pointer;
	}
	.del-yes {
		border-color: var(--blaze) !important;
		color: var(--blaze) !important;
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
	.add-ex.inblock {
		margin-top: 2px;
		font-size: 0.8rem;
		padding: 8px;
	}
	.addex {
		margin-top: 10px;
	}
	.choose {
		display: block;
		width: calc(100% - 28px);
		margin: 0 14px 12px;
		background: none;
		border: 1px dashed var(--blaze);
		color: var(--blaze);
		font-family: var(--font-body);
		font-size: 0.85rem;
		padding: 9px;
		cursor: pointer;
	}
	.choose:hover {
		background: var(--field);
	}
	.pickwrap {
		padding: 0 14px 12px;
	}
	.grp.forchoice {
		color: var(--muted);
		text-transform: none;
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
	.fields input::placeholder {
		color: var(--muted);
		opacity: 0.45;
	}
	.entryerr {
		margin: 8px 0 0;
		color: var(--blaze);
		font-size: 0.85rem;
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
