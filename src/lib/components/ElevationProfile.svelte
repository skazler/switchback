<script lang="ts">
	import type { Phase } from '$content/types';

	let {
		phases,
		currentWeek = null,
		open = false
	}: { phases?: Phase[]; currentWeek?: number | null; open?: boolean } = $props();

	const W = 100;
	const H = 34;
	const PAD_TOP = 6;
	const FLOOR = H - 2;

	// Fallback horizon for an open-ended program with no authored phases.
	const FALLBACK_WEEKS = 8;

	const hasPhases = $derived(!!phases && phases.length > 0);
	const totalWeeks = $derived(
		hasPhases ? Math.max(...phases!.map((p) => p.weeks[1])) : Math.max(currentWeek ?? 1, FALLBACK_WEEKS)
	);

	// Per-week elevation from the phase load (stepped, with a slight intra-phase
	// ramp so the climb reads as terrain, not stairs). Deload phases dip.
	function loadAt(week: number): number {
		if (!hasPhases) return 1;
		const p = phases!.find((ph) => week >= ph.weeks[0] && week <= ph.weeks[1]);
		if (!p) return 1;
		const span = p.weeks[1] - p.weeks[0] || 1;
		const t = (week - p.weeks[0]) / span; // 0..1 within phase
		return p.load + t * 0.6; // gentle ramp
	}

	const maxLoad = $derived(hasPhases ? Math.max(...phases!.map((p) => p.load)) + 0.6 : 1);

	function x(week: number): number {
		return ((week - 0.5) / totalWeeks) * W;
	}
	function y(load: number): number {
		return FLOOR - (load / maxLoad) * (FLOOR - PAD_TOP);
	}

	const weeks = $derived(Array.from({ length: totalWeeks }, (_, i) => i + 1));

	function areaPath(upto: number): string {
		const pts = weeks.filter((w) => w <= upto);
		if (pts.length === 0) return '';
		let d = `M ${x(pts[0])} ${FLOOR}`;
		for (const w of pts) d += ` L ${x(w)} ${y(loadAt(w))}`;
		d += ` L ${x(pts[pts.length - 1])} ${FLOOR} Z`;
		return d;
	}

	const done = $derived(currentWeek ? Math.min(currentWeek, totalWeeks) : 0);
	const fullPath = $derived(areaPath(totalWeeks));
	const donePath = $derived(done > 0 ? areaPath(done) : '');
	const summit = $derived(phases?.find((p) => p.summit));
	const dot = $derived(done > 0 ? { cx: x(done), cy: y(loadAt(done)) } : null);
</script>

<figure class="elev">
	{#if hasPhases}
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Program elevation profile">
			<!-- remaining terrain: raised fill + hairline stroke -->
			<path d={fullPath} fill="var(--field-raised)" stroke="var(--hairline)" stroke-width="0.5" vector-effect="non-scaling-stroke" />
			<!-- completed climb: blaze fill + blaze-lit stroke -->
			{#if donePath}
				<path d={donePath} fill="var(--blaze)" stroke="var(--blaze-lit)" stroke-width="1" vector-effect="non-scaling-stroke" />
			{/if}
			{#if summit}
				<line x1={x(summit.weeks[1])} y1={y(loadAt(summit.weeks[1]))} x2={x(summit.weeks[1])} y2={y(loadAt(summit.weeks[1])) - 6} stroke="var(--blaze)" stroke-width="1" vector-effect="non-scaling-stroke" />
				<polygon points="{x(summit.weeks[1])},{y(loadAt(summit.weeks[1])) - 6} {x(summit.weeks[1]) + 5},{y(loadAt(summit.weeks[1])) - 4.5} {x(summit.weeks[1])},{y(loadAt(summit.weeks[1])) - 3}" fill="var(--blaze)" />
			{/if}
			{#if dot}
				<circle cx={dot.cx} cy={dot.cy} r="1.6" fill="var(--ink)" vector-effect="non-scaling-stroke" />
			{/if}
		</svg>
		<figcaption class="phases">
			{#each phases! as p}
				<span class="phase microlabel" style="flex: {p.weeks[1] - p.weeks[0] + 1}">{p.label}</span>
			{/each}
		</figcaption>
	{:else}
		<!-- No authored periodization → honest week strip (FLOWS §14 fallback). -->
		<div class="strip" role="img" aria-label="Week {currentWeek ?? 1}{open ? ', ongoing' : ''}">
			{#each weeks as w}
				<span class="tick" class:done={currentWeek != null && w <= currentWeek} class:now={w === currentWeek}></span>
			{/each}
			{#if open}<span class="onward numeral">▲</span>{/if}
		</div>
		<figcaption class="phases">
			<span class="microlabel">Week {currentWeek ?? 1}{open ? ' · onward' : ` of ${totalWeeks}`}</span>
		</figcaption>
	{/if}
</figure>

<style>
	.elev {
		margin: 0;
	}
	svg {
		display: block;
		width: 100%;
		height: 72px;
	}
	.phases {
		display: flex;
		gap: 1px;
		margin-top: 6px;
		align-items: center;
	}
	.phase {
		text-align: center;
		border-top: 2px solid var(--hairline);
		padding-top: 4px;
	}
	.strip {
		display: flex;
		gap: 3px;
		align-items: center;
		height: 40px;
	}
	.tick {
		flex: 1;
		height: 100%;
		background: var(--field-raised);
		border: 0.5px solid var(--hairline);
	}
	.tick.done {
		background: var(--blaze);
		border-color: var(--blaze);
	}
	.tick.now {
		background: var(--blaze-lit);
	}
	.onward {
		color: var(--blaze);
		font-size: 1.2rem;
		padding-left: 4px;
	}
</style>
