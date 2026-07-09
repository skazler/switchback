<script lang="ts">
	import type { Program } from '$content/types';
	import ElevationProfile from './ElevationProfile.svelte';
	import SessionTable from './SessionTable.svelte';
	import TrailMarker from './TrailMarker.svelte';

	let {
		program,
		mode = 'active',
		currentWeek = null,
		open = false,
		todaySlug = null
	}: {
		program: Program;
		mode?: 'active' | 'archived';
		currentWeek?: number | null;
		open?: boolean;
		todaySlug?: string | null;
	} = $props();

	const meta = $derived(
		[
			mode === 'active' ? 'Active route' : 'Archived route',
			program.purpose,
			program.level,
			program.schedule === 'rotation' ? 'rotation' : null
		].filter(Boolean) as string[]
	);
</script>

<header class="phead">
	<p class="meta">
		{#each meta as m, i}
			{#if i > 0}<span class="sep" aria-hidden="true">/</span>{/if}<span class="microlabel">{m}</span>
		{/each}
	</p>
	<h1 class="display">{program.title}</h1>
</header>

{#if mode === 'active'}
	<div class="profile">
		<ElevationProfile phases={program.phases} {currentWeek} {open} />
	</div>
{/if}

{#if program.overviewHtml}
	<section class="overview">
		<p class="microlabel ohead">Overview</p>
		<div class="obody">{@html program.overviewHtml}</div>
	</section>
{/if}

<hr class="rule wide" />

{#if mode === 'active'}
	<p class="microlabel">Days</p>
	<ol class="days">
		{#each program.days as day}
			<li>
				<a class="dayrow" class:today={day.slug === todaySlug} href="/route/{day.slug}">
					<span class="code numeral">{day.code}</span>
					<span class="daylabel display">{day.label}</span>
					<span class="count microlabel">{day.rows.filter((r) => r.name).length} moves</span>
					<TrailMarker marker={day.marker} />
					<span class="arrow" aria-hidden="true">→</span>
				</a>
			</li>
		{/each}
	</ol>
{:else}
	{#each program.days as day}
		<section class="dayblock">
			<div class="dayhead">
				<h2 class="display">
					{#if day.weekday >= 0}<span class="code numeral">{day.code}</span>{/if}<span class="dl">{day.label}</span>
				</h2>
				<TrailMarker marker={day.marker} size={18} />
			</div>
			<SessionTable {day} />
		</section>
	{/each}
{/if}

<style>
	.phead {
		margin-bottom: 4px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 0 0 4px;
	}
	.meta .sep {
		color: var(--hairline);
	}
	.phead h1 {
		font-size: clamp(2rem, 7vw, 3.2rem);
		margin-top: 2px;
	}
	.profile {
		margin: 18px 0 22px;
	}

	/* Overview — a deliberate panel, not a dump. */
	.overview {
		margin: 20px 0 4px;
		border-left: 2px solid var(--hairline);
		padding: 4px 0 4px 16px;
	}
	.ohead {
		color: var(--blaze);
		margin: 0 0 8px;
	}
	:global([data-mode='paper']) .ohead {
		color: var(--muted);
	}
	/* Bold labels that sit alone in a paragraph become section microheads. */
	.obody :global(p > strong:only-child) {
		display: block;
		font: inherit;
		font-family: var(--font-body);
		font-weight: 500;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		margin-top: 14px;
	}
	.obody :global(p) {
		margin: 6px 0;
	}
	.obody :global(ul) {
		margin: 6px 0;
		padding-left: 18px;
	}
	.obody :global(li) {
		margin: 2px 0;
	}
	.obody :global(blockquote) {
		border: 0;
		margin: 0 0 10px;
		padding: 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 500;
		font-style: normal;
		color: var(--ink);
	}
	/* Weekly grid — render as a clean schedule table. */
	.obody :global(table) {
		display: block;
		overflow-x: auto;
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		margin: 12px 0;
		white-space: nowrap;
	}
	.obody :global(th),
	.obody :global(td) {
		border: 0.5px solid var(--hairline);
		padding: 6px 9px;
		text-align: left;
		vertical-align: top;
	}
	.obody :global(thead th) {
		color: var(--blaze);
		font-weight: 500;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	:global([data-mode='paper']) .obody :global(thead th) {
		color: var(--muted);
	}

	.rule.wide {
		margin: 20px 0 16px;
	}
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.dayrow {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--tap);
		padding: 12px 14px;
		border: 1px solid var(--hairline);
		margin-top: -1px;
	}
	.dayrow:hover {
		border-color: var(--ink);
	}
	.dayrow.today {
		border-color: var(--blaze);
		border-left-width: 3px;
	}
	.code {
		min-width: 28px;
		color: var(--muted);
		font-weight: 600;
	}
	.daylabel {
		font-size: 1.3rem;
		text-transform: capitalize;
	}
	.count {
		margin-left: auto;
	}
	.arrow {
		font-family: var(--font-display);
		font-size: 1.3rem;
	}
	.dayblock {
		margin: 26px 0;
	}
	.dayhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 2px solid var(--blaze);
		padding-bottom: 6px;
	}
	:global([data-mode='paper']) .dayhead {
		border-bottom-color: var(--ink);
	}
	.dayhead h2 {
		text-transform: capitalize;
	}
	.dayhead h2 .code {
		font-size: 1.4rem;
		margin-right: 0.4em;
	}
</style>
