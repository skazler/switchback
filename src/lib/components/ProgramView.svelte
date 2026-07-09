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
</script>

<header class="phead">
	<p class="microlabel">
		{mode === 'active' ? 'Active route' : 'Archived route'}{program.purpose
			? ` · ${program.purpose}`
			: ''}{program.level ? ` · ${program.level}` : ''}
	</p>
	<h1 class="display">{program.title}</h1>
</header>

{#if mode === 'active'}
	<div class="profile">
		<ElevationProfile phases={program.phases} {currentWeek} {open} />
	</div>
{/if}

{#if program.overviewHtml}
	<div class="overview">{@html program.overviewHtml}</div>
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
				<h2 class="display"><span class="code numeral">{day.code}</span> {day.label}</h2>
				<TrailMarker marker={day.marker} size={18} />
			</div>
			<SessionTable {day} />
		</section>
	{/each}
{/if}

<style>
	.phead h1 {
		font-size: clamp(2rem, 7vw, 3.2rem);
		margin-top: 2px;
	}
	.profile {
		margin: 18px 0 22px;
	}
	.overview :global(h2),
	.overview :global(h3) {
		margin: 18px 0 6px;
	}
	.overview :global(p) {
		margin: 8px 0;
	}
	.overview :global(ul) {
		margin: 8px 0;
		padding-left: 20px;
	}
	.overview :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		margin: 10px 0;
	}
	.overview :global(th),
	.overview :global(td) {
		border: 0.5px solid var(--hairline);
		padding: 5px 8px;
		text-align: left;
	}
	.overview :global(th) {
		color: var(--muted);
		font-weight: 500;
	}
	.overview :global(blockquote) {
		border-left: 2px solid var(--hairline);
		margin: 10px 0;
		padding-left: 12px;
		color: var(--muted);
		font-style: italic;
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
	.dayhead h2 .code {
		font-size: 1.4rem;
	}
</style>
