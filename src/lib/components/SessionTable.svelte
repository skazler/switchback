<script lang="ts">
	import type { ProgramDay, SessionRow } from '$content/types';
	import TrailMarker from './TrailMarker.svelte';

	let { day }: { day: ProgramDay } = $props();

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

	// Emit a group subhead only when the grouping label changes.
	function withHeads(rows: SessionRow[]) {
		let last: string | undefined;
		return rows.map((r) => {
			const head = r.group && r.group !== last ? r.group : undefined;
			last = r.group ?? last;
			return { row: r, head };
		});
	}
</script>

<ol class="session">
	{#each withHeads(day.rows) as { row, head }}
		{#if head}
			<li class="grouphead microlabel">{head}</li>
		{/if}
		<li class="row">
			<div class="line">
				<span class="name display">
					{#if row.ref?.kind === 'exercise' && row.ref.url}
						<a href={row.ref.url} target="_blank" rel="noopener noreferrer">{row.name}</a>
					{:else}
						{row.name}
					{/if}
					{#if row.ref?.kind === 'block'}<span class="tag microlabel">block</span>{/if}
				</span>
				{#if row.marker}<TrailMarker marker={row.marker} />{/if}
			</div>
			{#if prescription(row)}<div class="rx muted numeral">{prescription(row)}</div>{/if}
			{#if row.notes}<div class="note muted">{row.notes}</div>{/if}
		</li>
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
