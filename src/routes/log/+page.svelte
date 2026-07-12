<script lang="ts">
	import { onMount } from 'svelte';
	import { allSessions, setsForSession, putSession, putSet, type LocalSession, type LocalSet } from '$lib/client/idb';
	import { removeSession, syncNow } from '$lib/client/sync.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface LogSet {
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
	interface LogSession {
		id: string;
		date: string;
		program_id: string | null;
		day: string | null;
		started_at?: string | null;
		completed_at?: string | null;
		notes?: string | null;
		sets: LogSet[];
		local?: boolean;
		pendingSync?: boolean;
	}

	let sessions = $state<LogSession[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let owner = $state(false);
	let loading = $state(true);
	let error = $state('');
	const LIMIT = 40;

	const prettify = (id: string) => (data.names[id] ?? id.replace(/^x-/, '').replace(/-/g, ' '));

	function tokens(setsForEx: LogSet[]): string {
		return setsForEx
			.map((s) => {
				if (s.grade) return `${s.grade}${s.notes === 'sent' ? ' sent' : ''}`;
				if (s.distance != null || (s.duration_s != null && s.weight == null && s.reps == null)) {
					const p = [];
					if (s.duration_s != null) p.push(`${Math.round(s.duration_s / 60)}m`);
					if (s.distance != null) p.push(`${s.distance}mi`);
					return p.join(' ') || 'done';
				}
				if (s.weight != null && s.reps != null) return `${s.weight}${s.unit ?? 'lb'} x ${s.reps}`;
				if (s.reps != null) return `${s.reps} reps`;
				return 'logged';
			})
			.join('   ');
	}

	function grouped(s: LogSession): { name: string; sets: LogSet[] }[] {
		const m = new Map<string, LogSet[]>();
		for (const x of s.sets) m.set(x.exercise_id, [...(m.get(x.exercise_id) ?? []), x]);
		return [...m.entries()].map(([id, sets]) => ({ name: prettify(id), sets }));
	}

	// ── owner-only editing ───────────────────────────────────────────────
	type EditField = 'weight' | 'reps' | 'duration' | 'distance' | 'grade';
	interface SetDraft {
		id: string;
		exercise_id: string;
		set_num: number | null;
		fields: EditField[];
		weight: string;
		reps: string;
		duration: string; // minutes, as text
		distance: string;
		grade: string;
		sent: boolean;
	}

	// Editing preserves a set's original shape (which fields applied) rather
	// than letting you switch a strength set into a ride set etc. — fixing a
	// wrong number, not changing what was logged.
	function fieldsFor(s: LogSet): EditField[] {
		const f: EditField[] = [];
		if (s.grade != null) f.push('grade');
		if (s.distance != null) f.push('distance');
		if (s.duration_s != null) f.push('duration');
		if (s.weight != null) f.push('weight');
		if (s.reps != null) f.push('reps');
		if (!f.length) f.push('reps');
		return f;
	}

	let editingId = $state('');
	let editNotes = $state('');
	let editSets = $state<SetDraft[]>([]);
	let saving = $state(false);

	function startEdit(s: LogSession) {
		editingId = s.id;
		editNotes = s.notes ?? '';
		editSets = s.sets.map((x) => ({
			id: x.id,
			exercise_id: x.exercise_id,
			set_num: x.set_num,
			fields: fieldsFor(x),
			weight: x.weight != null ? String(x.weight) : '',
			reps: x.reps != null ? String(x.reps) : '',
			duration: x.duration_s != null ? String(Math.round(x.duration_s / 60)) : '',
			distance: x.distance != null ? String(x.distance) : '',
			grade: x.grade ?? '',
			sent: x.notes === 'sent'
		}));
	}

	function cancelEdit() {
		editingId = '';
	}

	async function saveEdit(s: LogSession) {
		saving = true;
		try {
			const notes = editNotes.trim() || undefined;
			await putSession({
				id: s.id,
				date: s.date,
				program_id: s.program_id ?? '',
				day: s.day ?? '',
				started_at: s.started_at ?? new Date().toISOString(),
				completed_at: s.completed_at ?? undefined,
				notes,
				planned: [],
				synced: 0
			});
			const newSets: LogSet[] = [];
			for (const d of editSets) {
				const set: LocalSet = {
					id: d.id,
					session_id: s.id,
					exercise_id: d.exercise_id,
					set_num: d.set_num ?? undefined,
					unit: 'lb',
					logged_at: new Date().toISOString(),
					synced: 0
				};
				if (d.fields.includes('weight') && d.weight !== '') set.weight = Number(d.weight);
				if (d.fields.includes('reps') && d.reps !== '') set.reps = Number(d.reps);
				if (d.fields.includes('duration') && d.duration !== '') set.duration_s = Math.round(Number(d.duration) * 60);
				if (d.fields.includes('distance') && d.distance !== '') set.distance = Number(d.distance);
				if (d.fields.includes('grade') && d.grade !== '') {
					set.grade = d.grade;
					set.notes = d.sent ? 'sent' : 'attempt';
				}
				await putSet(set);
				newSets.push({
					id: d.id,
					exercise_id: d.exercise_id,
					set_num: set.set_num ?? null,
					reps: set.reps ?? null,
					weight: set.weight ?? null,
					unit: set.unit ?? null,
					duration_s: set.duration_s ?? null,
					distance: set.distance ?? null,
					grade: set.grade ?? null,
					notes: set.notes ?? null
				});
			}
			syncNow();
			sessions = sessions.map((x) => (x.id === s.id ? { ...x, notes, sets: newSets, local: true, pendingSync: true } : x));
			editingId = '';
		} finally {
			saving = false;
		}
	}

	async function localSessions(): Promise<LogSession[]> {
		try {
			const ls = await allSessions();
			const out: LogSession[] = [];
			for (const s of ls as LocalSession[]) {
				const st = (await setsForSession(s.id)) as LocalSet[];
				out.push({
					id: s.id,
					date: s.date,
					program_id: s.program_id,
					day: s.day,
					started_at: s.started_at,
					completed_at: s.completed_at,
					notes: s.notes,
					local: true,
					pendingSync: s.synced !== 1,
					sets: st.map((x) => ({
						id: x.id,
						exercise_id: x.exercise_id,
						set_num: x.set_num ?? null,
						reps: x.reps ?? null,
						weight: x.weight ?? null,
						unit: x.unit ?? null,
						duration_s: x.duration_s ?? null,
						distance: x.distance ?? null,
						grade: x.grade ?? null,
						notes: x.notes ?? null
					}))
				});
			}
			return out;
		} catch {
			return [];
		}
	}

	async function fetchPage(reset = false) {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/log?limit=${LIMIT}&offset=${reset ? 0 : offset}`);
			if (!res.ok) throw new Error(`log ${res.status}`);
			const j = (await res.json()) as { owner: boolean; total: number; sessions: LogSession[] };
			owner = j.owner;
			total = j.total;
			const remote: LogSession[] = j.sessions;
			if (reset) {
				// Merge local drafts with D1 at first load, dedup by id. A local copy
				// that hasn't synced yet is fresher than whatever's in D1 for that id
				// (e.g. notes typed after an early logSet()-triggered sync already
				// pushed a notes-less row) — prefer it over the remote row.
				const local = await localSessions();
				const localById = new Map(local.map((s) => [s.id, s]));
				const remoteIds = new Set(remote.map((s) => s.id));
				const merged = remote.map((r) => {
					const l = localById.get(r.id);
					return l?.pendingSync ? l : r;
				});
				const localOnly = local.filter((s) => !remoteIds.has(s.id));
				sessions = [...localOnly, ...merged].sort((a, b) => (b.date + (b.completed_at ?? '')).localeCompare(a.date + (a.completed_at ?? '')));
				offset = remote.length;
			} else {
				const ids = new Set(sessions.map((s) => s.id));
				sessions = [...sessions, ...remote.filter((s) => !ids.has(s.id))];
				offset += remote.length;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'failed to load';
		} finally {
			loading = false;
		}
	}

	onMount(() => fetchPage(true));

	async function handleDelete(id: string) {
		if (!confirm('Delete this session and its logged sets?')) return;
		await removeSession(id);
		sessions = sessions.filter((s) => s.id !== id);
		total = Math.max(0, total - 1);
	}

	const fmtDate = (d: string) => {
		const [y, m, day] = d.split('-').map(Number);
		return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	};
</script>

<svelte:head><title>Log · Switchback</title></svelte:head>

<p class="microlabel">Log · session history</p>
<h1 class="display">Log</h1>

{#if error}
	<div class="empty">
		<p class="muted">Couldn't load history ({error}).</p>
		<button class="btn-ghost" onclick={() => fetchPage(true)}>Retry</button>
	</div>
{:else if !sessions.length && !loading}
	<div class="empty">
		<p>No sessions yet.</p>
		<a class="btn-ghost" href="/route">Go to the route →</a>
	</div>
{:else}
	<p class="count microlabel">{total} sessions{owner ? '' : ' · sign in for notes'}</p>
	<ol class="log">
		{#each sessions as s (s.id)}
			<li class="sess">
				<div class="shead">
					<span class="date display">{fmtDate(s.date)}</span>
					<span class="tag microlabel">
						{#if s.local}<span class="localdot">▲</span>{/if}
						{s.day ?? s.program_id ?? ''}
						{#if owner}
							<button class="del" aria-label="Edit session" onclick={() => (editingId === s.id ? cancelEdit() : startEdit(s))}>{editingId === s.id ? 'cancel' : 'edit'}</button>
							<button class="del" aria-label="Delete session" onclick={() => handleDelete(s.id)}>×</button>
						{/if}
					</span>
				</div>
				{#if editingId === s.id}
					<div class="editform">
						{#each editSets as d, i (d.id)}
							<div class="editrow">
								<span class="editname">{prettify(d.exercise_id)}</span>
								<div class="editfields">
									{#if d.fields.includes('weight')}<label>lb<input inputmode="decimal" bind:value={editSets[i].weight} /></label>{/if}
									{#if d.fields.includes('reps')}<label>reps<input inputmode="numeric" bind:value={editSets[i].reps} /></label>{/if}
									{#if d.fields.includes('duration')}<label>min<input inputmode="decimal" bind:value={editSets[i].duration} /></label>{/if}
									{#if d.fields.includes('distance')}<label>mi<input inputmode="decimal" bind:value={editSets[i].distance} /></label>{/if}
									{#if d.fields.includes('grade')}
										<label>grade<input bind:value={editSets[i].grade} /></label>
										<button class="sentbtn" class:on={d.sent} onclick={() => (editSets[i].sent = !editSets[i].sent)}>{d.sent ? '✓ sent' : 'attempt'}</button>
									{/if}
								</div>
							</div>
						{/each}
						<label class="editnotes-field">
							<span class="microlabel">Notes</span>
							<textarea bind:value={editNotes}></textarea>
						</label>
						<button class="savebtn" onclick={() => saveEdit(s)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
					</div>
				{:else}
					{#if s.sets.length}
						<ul class="exs">
							{#each grouped(s) as g}
								<li class="ex"><span class="exname">{g.name}</span><span class="toks">{tokens(g.sets)}</span></li>
							{/each}
						</ul>
					{/if}
					{#if s.notes}<p class="snote muted">{s.notes}</p>{/if}
				{/if}
			</li>
		{/each}
	</ol>

	{#if sessions.length < total}
		<button class="more" onclick={() => fetchPage(false)} disabled={loading}>
			{loading ? 'Loading…' : `Load more (${total - sessions.length} older)`}
		</button>
	{/if}
{/if}

<style>
	h1 {
		margin-bottom: 8px;
	}
	.count {
		color: var(--muted);
		margin-bottom: 16px;
	}
	.empty {
		border-left: 3px solid var(--hairline);
		padding: 16px 20px;
		background: var(--field-raised);
	}
	.empty p {
		margin: 0 0 10px;
	}
	.log {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.sess {
		padding: 14px 0;
		border-top: 0.5px solid var(--hairline);
	}
	.shead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 6px;
	}
	.date {
		font-size: 1.15rem;
		font-weight: 600;
	}
	.tag {
		color: var(--muted);
		text-align: right;
	}
	.localdot {
		color: var(--blaze);
		margin-right: 4px;
	}
	.del {
		background: none;
		border: none;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1;
		padding: 0 0 0 8px;
		cursor: pointer;
	}
	.del:hover {
		color: var(--blaze);
	}
	.editform {
		border-left: 3px solid var(--blaze);
		background: var(--field-raised);
		padding: 12px 14px;
		margin-top: 4px;
	}
	.editrow {
		padding: 6px 0;
		border-bottom: 0.5px solid var(--hairline);
	}
	.editrow:last-of-type {
		border-bottom: none;
	}
	.editname {
		display: block;
		text-transform: capitalize;
		font-size: 0.9rem;
		margin-bottom: 4px;
	}
	.editfields {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 10px;
	}
	.editfields label {
		display: flex;
		flex-direction: column;
		font-family: var(--font-body);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		gap: 3px;
	}
	.editfields input {
		width: 5.5ch;
		background: var(--field);
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		text-align: center;
		padding: 5px;
		font-variant-numeric: tabular-nums;
	}
	.sentbtn {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		font-family: var(--font-body);
		font-size: 0.78rem;
		padding: 6px 9px;
		cursor: pointer;
	}
	.sentbtn.on {
		border-color: var(--blaze);
		color: var(--blaze);
	}
	.editnotes-field {
		display: block;
		margin-top: 10px;
	}
	.editnotes-field textarea {
		display: block;
		width: 100%;
		margin-top: 4px;
		min-height: 56px;
		background: var(--field);
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.9rem;
		padding: 8px 10px;
		resize: vertical;
		box-sizing: border-box;
	}
	.editnotes-field textarea:focus {
		border-color: var(--blaze);
		outline: none;
	}
	.savebtn {
		margin-top: 10px;
		width: 100%;
		background: var(--blaze);
		color: var(--field);
		border: none;
		font-family: var(--font-display);
		font-weight: 600;
		padding: 10px;
		cursor: pointer;
	}
	.savebtn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.exs {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ex {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		padding: 3px 0;
		align-items: baseline;
	}
	.exname {
		text-transform: capitalize;
		font-size: 0.98rem;
	}
	.toks {
		color: var(--muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.snote {
		margin: 6px 0 0;
		font-size: 0.85rem;
		font-style: italic;
	}
	.more {
		margin-top: 20px;
		width: 100%;
		background: none;
		border: 1px solid var(--hairline);
		color: var(--ink);
		font-family: var(--font-display);
		font-weight: 600;
		padding: 12px;
		cursor: pointer;
	}
	.more:hover {
		border-color: var(--blaze);
		color: var(--blaze);
	}
</style>
