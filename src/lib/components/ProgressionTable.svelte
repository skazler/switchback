<script lang="ts">
	import type { Program, ProgressionWeek } from '$content/types';
	import { formatWeekRange } from '$lib/plan-dates';

	let {
		program,
		currentWeek = null
	}: { program: Program; currentWeek?: number | null } = $props();

	const labels = $derived(program.progression?.[0]?.columns.map((c) => c.label) ?? []);
	// Dates only exist if the program is anchored to a start Monday.
	const dated = $derived(Boolean(program.start));

	function value(week: ProgressionWeek, label: string): string {
		return week.columns.find((c) => c.label === label)?.value ?? '';
	}
</script>

{#if program.progression?.length}
	<section class="prog">
		<p class="microlabel phead">By week</p>
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th class="wk">Week</th>
						{#if dated}<th class="dates">Dates</th>{/if}
						{#each labels as label}<th>{label}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each program.progression as week}
						<tr class:now={week.week === currentWeek}>
							<th class="wk numeral" scope="row">{week.week}</th>
							{#if dated}
								<td class="dates numeral">{formatWeekRange(program.start!, week.week)}</td>
							{/if}
							{#each labels as label}<td>{value(week, label)}</td>{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<style>
	.prog {
		margin: 22px 0 4px;
	}
	.phead {
		color: var(--blaze);
		margin: 0 0 8px;
	}
	:global([data-mode='paper']) .phead {
		color: var(--muted);
	}
	.scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		white-space: nowrap;
	}
	th,
	td {
		border: 0.5px solid var(--hairline);
		padding: 6px 9px;
		text-align: left;
		vertical-align: top;
		font-weight: 400;
	}
	thead th {
		color: var(--blaze);
		font-weight: 500;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	:global([data-mode='paper']) thead th {
		color: var(--muted);
	}
	.wk {
		width: 1%;
		color: var(--muted);
	}
	.dates {
		width: 1%;
		color: var(--muted);
	}
	/* The week you're in — the row you scan for. */
	tbody tr.now {
		background: var(--field-raised);
	}
	tbody tr.now th,
	tbody tr.now td {
		border-color: var(--blaze);
		color: var(--ink);
	}
	tbody tr.now th.wk {
		box-shadow: inset 3px 0 0 var(--blaze);
		font-weight: 600;
	}
</style>
