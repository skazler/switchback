<script lang="ts">
	import type { ProgramDay, SessionRow } from '$content/types';
	import TrailMarker from './TrailMarker.svelte';
	import { choiceHref, displayName, displayNote, isChoice, toRenderItems } from '$lib/session-display';

	let { day }: { day: ProgramDay } = $props();

	const items = $derived(toRenderItems(day.rows));

	// Week A / Week B alternate week to week — render as a toggle and show only
	// the selected week's rows (dividers themselves are dropped).
	const weekLabels = $derived(items.filter((i) => i.kind === 'week').map((i) => i.label));
	let activeWeek = $state('');
	$effect(() => {
		if (weekLabels.length && !weekLabels.includes(activeWeek)) activeWeek = weekLabels[0];
	});
	const shown = $derived.by(() => {
		if (!weekLabels.length) return items;
		const out: typeof items = [];
		let cur: string | null = null;
		for (const it of items) {
			if (it.kind === 'week') {
				cur = it.label;
				continue;
			}
			if (cur === null || cur === activeWeek) out.push(it);
		}
		return out;
	});

	// "6 to 8" → "6–8"; join sets/reps/rest into a muted prescription line.
	function prescription(r: SessionRow): string {
		const parts: string[] = [];
		const reps = r.reps?.replace(/\s*to\s*/gi, '–');
		if (r.sets && reps) parts.push(`${r.sets} × ${reps}`);
		else if (r.sets) parts.push(`${r.sets} sets`);
		else if (reps) parts.push(reps);
		if (r.rest) parts.push(`rest ${r.rest}`);
		return parts.join(' · ');
	}
</script>

{#if weekLabels.length}
	<div class="weeks">
		{#each weekLabels as w}
			<button class="wk" class:on={activeWeek === w} onclick={() => (activeWeek = w)}>{w}</button>
		{/each}
		<span class="wknote microlabel">weekly rotation</span>
	</div>
{/if}

<ol class="session">
	{#each shown as item}
		{#if item.kind === 'session'}
			<li class="sessionband">
				<span class="display">{item.label}</span>
				<span class="microlabel">two-a-day</span>
			</li>
		{:else if item.kind === 'week'}
			<!-- dividers handled by the toggle above -->
		{:else if item.kind === 'group'}
			<li class="grouphead microlabel">{item.label}</li>
		{:else}
			{@const row = item.row}
			<li class="row">
				<div class="line">
					<span class="name display">
						{#if isChoice(row.name)}
							<a class="choice" href={choiceHref(row)}>{displayName(row.name)}<span class="opt" aria-label="choose from library">↗</span></a>
						{:else if row.ref?.kind === 'exercise' && row.ref.url}
							<a href={row.ref.url} target="_blank" rel="noopener noreferrer">{displayName(row.name)}</a>
						{:else}
							{displayName(row.name)}
						{/if}
						{#if row.ref?.kind === 'block'}<span class="tag microlabel">block</span>{/if}
					</span>
					{#if row.marker}<TrailMarker marker={row.marker} />{/if}
				</div>
				{#if prescription(row)}<div class="rx muted numeral">{prescription(row)}</div>{/if}
				{#if displayNote(row.notes)}<div class="note muted">{displayNote(row.notes)}</div>{/if}
			</li>
		{/if}
	{/each}
</ol>

<style>
	.session {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.grouphead {
		padding: 18px 0 6px;
		color: var(--blaze);
	}
	:global([data-mode='paper']) .grouphead {
		color: var(--muted);
	}
	/* Two-a-day session divider — a clear band splitting the day. */
	.sessionband {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 22px 0 4px;
		padding-bottom: 6px;
		border-bottom: 2px solid var(--hairline);
	}
	.sessionband .display {
		font-size: 1.35rem;
		font-weight: 600;
		text-transform: capitalize;
	}
	.sessionband .microlabel {
		color: var(--muted);
	}
	/* Weekly rotation toggle — Week A / Week B alternate week to week. */
	.weeks {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0 14px;
	}
	.wk {
		background: none;
		border: 1px solid var(--hairline);
		color: var(--muted);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-transform: capitalize;
		padding: 8px 16px;
		cursor: pointer;
	}
	.wk.on {
		background: var(--blaze);
		border-color: var(--blaze);
		color: var(--on-blaze, var(--field));
	}
	.wknote {
		margin-left: auto;
		color: var(--muted);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.row {
		padding: 10px 0;
		border-top: 0.5px solid var(--hairline);
	}
	.line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.name {
		font-size: 1.3rem;
		font-weight: 500;
		line-height: 1.1;
	}
	.name a {
		border-bottom: 1px solid var(--hairline);
	}
	.name a:hover {
		border-bottom-color: var(--blaze);
	}
	.name a.choice {
		border-bottom-color: var(--blaze);
	}
	.opt {
		color: var(--blaze);
		font-size: 0.8em;
		margin-left: 3px;
		vertical-align: baseline;
	}
	.tag {
		margin-left: 8px;
		border: 0.5px solid var(--hairline);
		padding: 1px 5px;
		vertical-align: middle;
	}
	.rx {
		font-size: 1rem;
		margin-top: 2px;
		letter-spacing: 0.01em;
	}
	.note {
		font-size: 0.85rem;
		margin-top: 3px;
		font-style: italic;
	}
</style>
