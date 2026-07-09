<script lang="ts">
	import BlazeSign from '$lib/components/BlazeSign.svelte';
	import TrailMarker from '$lib/components/TrailMarker.svelte';
	import { resolveToday } from '$lib/today';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const program = $derived(data.program);
	const counts = $derived(data.counts);

	// SSR shows the build-time result; after hydration recompute against the
	// viewer's real current date so "today" is never stale.
	let clientToday = $state<ReturnType<typeof resolveToday> | null>(null);
	$effect(() => {
		if (program) clientToday = resolveToday(program, new Date());
	});
	const today = $derived(clientToday ?? data.today);

	function longDate(iso: string): string {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Switchback</title>
	<meta name="description" content="Training system — plans, exercise library, logging." />
</svelte:head>

<section class="hero">
	<div class="hero-inner">
		<p class="microlabel htag">Trailhead · Today</p>

		{#if today.status === 'session'}
			<div class="card">
				<div class="cardhead">
					<h1 class="display">{today.day.label}</h1>
					<TrailMarker marker={today.day.marker} size={22} />
				</div>
				<p class="microlabel sub">
					Week {today.week}{today.phase ? ` · ${today.phase.label}` : ''} · {program?.title}
				</p>
				<a class="btn-primary go" href="/route/{today.day.slug}">View session →</a>
			</div>
		{:else if today.status === 'rest'}
			<div class="card">
				<h1 class="display">No route today</h1>
				<p class="microlabel sub">Week {today.week} · rest day</p>
				<a class="btn-ghost go" href="/route">See the route →</a>
			</div>
		{:else if today.status === 'before-start'}
			<div class="card">
				<h1 class="display">Route begins {longDate(today.startsOn)}</h1>
				<a class="btn-ghost go" href="/route">Preview the route →</a>
			</div>
		{:else}
			<div class="card">
				<h1 class="display">No active route</h1>
				<a class="btn-ghost go" href="/routes">Browse programs →</a>
			</div>
		{/if}
	</div>
</section>

<nav class="wayfinding" aria-label="Wayfinding">
	<BlazeSign href="/route" label="Route" meta={program?.title ?? 'no active program'} />
	<BlazeSign href="/library" label="Library" meta="{counts.moves} moves" />
	<BlazeSign href="/summits" label="Summits" meta="PRs & goals" />
	<BlazeSign href="/log" label="Log" meta="session history" />
	<BlazeSign href="/routes" label="All programs" meta="{counts.programs} incl. {counts.archived} archived" />
	<BlazeSign href="/get" label="Install" meta="add to home screen" />
</nav>

<style>
	/* Full-bleed hero: breaks out of the padded content column and pulls up
	   under the sticky header. The photo is atmosphere — a heavy scrim fades
	   it into the page so the card stays legible. */
	.hero {
		position: relative;
		width: 100vw;
		margin-left: calc(50% - 50vw);
		margin-top: -22px;
		min-height: min(58vh, 540px);
		display: flex;
		background-size: cover;
		background-position: center 28%;
		background-repeat: no-repeat;
	}
	:global([data-mode='dark']) .hero {
		background-image: url(/hero-dark.jpg);
	}
	:global([data-mode='paper']) .hero {
		background-image: url(/hero-paper.jpg);
	}
	.hero::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(
			to bottom,
			rgba(19, 19, 18, 0.15) 0%,
			rgba(19, 19, 18, 0.5) 50%,
			rgba(19, 19, 18, 0.88) 82%,
			var(--field) 100%
		);
	}
	:global([data-mode='paper']) .hero::after {
		background: linear-gradient(
			to bottom,
			rgba(250, 250, 248, 0.05) 0%,
			rgba(250, 250, 248, 0.42) 50%,
			rgba(250, 250, 248, 0.86) 82%,
			var(--field) 100%
		);
	}
	.hero-inner {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 20px clamp(16px, 5vw, 28px) 20px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.htag {
		margin: 0 0 12px;
	}
	.card {
		border-left: 3px solid var(--blaze);
		background: var(--field-raised);
		padding: 18px 20px;
	}
	.cardhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
	}
	.card h1 {
		font-size: clamp(2rem, 8vw, 3rem);
		text-transform: capitalize;
	}
	.sub {
		margin: 6px 0 0;
	}
	.go {
		margin-top: 16px;
	}
	.wayfinding {
		display: flex;
		flex-direction: column;
		margin-top: 22px;
	}
</style>
