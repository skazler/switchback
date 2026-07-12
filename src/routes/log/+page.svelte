<script lang="ts">
	import { onMount } from 'svelte';
	import { allSessions, setsForSession, type LocalSession, type LocalSet } from '$lib/client/idb';
	import { removeSession } from '$lib/client/sync.svelte';
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

	// Consecutive identical entries collapse into one "×N" so "3 sets" is
	// explicit instead of the same value repeated once per set.
	function collapse(raw: string[], fmt: (text: string, count: number) => string): string[] {
		const groups: { text: string; count: number }[] = [];
		for (const t of raw) {
			const last = groups[groups.length - 1];
			if (last && last.text === t) last.count++;
			else groups.push({ text: t, count: 1 });
		}
		return groups.map((g) => (g.count > 1 ? fmt(g.text, g.count) : g.text));
	}

	function tokens(setsForEx: LogSet[]): string {
		// Strength sets (weight+reps, or bodyweight reps-only) use the
		// notation lifters actually write — "3×6 @ 55lb" — instead of
		// chaining weight×reps×setcount with the same symbol, which reads as
		// three ambiguous bare numbers ("55lb x 6 x 3" — x 6 what? x 3 what?).
		if (setsForEx.every((s) => s.grade == null && s.duration_s == null && s.distance == null && s.reps != null)) {
			const hasWeight = setsForEx.some((s) => s.weight != null);
			const raw = setsForEx.map((s) => (s.weight != null ? `${s.reps} @ ${s.weight}${s.unit ?? 'lb'}` : `${s.reps}`));
			const parts = collapse(raw, (text, count) => `${count}×${text}`);
			return hasWeight ? parts.join(', ') : `${parts.join(', ')} reps`;
		}

		const raw = setsForEx.map((s) => {
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
		});
		return collapse(raw, (text, count) => `${text} ×${count}`).join('   ');
	}

	function grouped(s: LogSession): { name: string; sets: LogSet[] }[] {
		const m = new Map<string, LogSet[]>();
		for (const x of s.sets) m.set(x.exercise_id, [...(m.get(x.exercise_id) ?? []), x]);
		return [...m.entries()].map(([id, sets]) => ({ name: prettify(id), sets }));
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
						{#if owner}<button class="del" aria-label="Delete session" onclick={() => handleDelete(s.id)}>×</button>{/if}
					</span>
				</div>
				{#if s.sets.length}
					<ul class="exs">
						{#each grouped(s) as g}
							<li class="ex"><span class="exname">{g.name}</span><span class="toks">{tokens(g.sets)}</span></li>
						{/each}
					</ul>
				{/if}
				{#if s.notes}<p class="snote muted">{s.notes}</p>{/if}
				{#if owner}<a class="editlink" href={`/session?id=${s.id}`}>Edit →</a>{/if}
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
	.editlink {
		display: inline-block;
		margin-top: 6px;
		color: var(--muted);
		font-size: 0.78rem;
		text-decoration: none;
	}
	.editlink:hover {
		color: var(--blaze);
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
