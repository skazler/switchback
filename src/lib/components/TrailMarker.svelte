<script lang="ts">
	import type { Intensity } from '$content/types';

	let { marker, size = 14 }: { marker: Intensity; size?: number } = $props();

	const label: Record<Intensity, string> = {
		green: 'easy',
		blue: 'moderate',
		black: 'hard',
		'double-black': 'max'
	};
</script>

<!-- Intensity as ski-trail difficulty (DESIGN.md). Flat geometric shapes. -->
<span class="marker" title={label[marker]} aria-label={label[marker]} style="--s:{size}px">
	{#if marker === 'green'}
		<svg viewBox="0 0 20 20" width={size} height={size}><circle cx="10" cy="10" r="8" fill="var(--marker-green)" /></svg>
	{:else if marker === 'blue'}
		<svg viewBox="0 0 20 20" width={size} height={size}><rect x="2" y="2" width="16" height="16" fill="var(--marker-blue)" /></svg>
	{:else if marker === 'black'}
		<svg viewBox="0 0 20 20" width={size} height={size}><rect x="4" y="4" width="12" height="12" transform="rotate(45 10 10)" fill="var(--marker-black)" stroke="var(--marker-stroke)" stroke-width="1.4" /></svg>
	{:else}
		<svg viewBox="0 0 34 20" width={size * 1.7} height={size}>
			<rect x="3" y="4" width="12" height="12" transform="rotate(45 9 10)" fill="var(--marker-black)" stroke="var(--marker-stroke)" stroke-width="1.4" />
			<rect x="17" y="4" width="12" height="12" transform="rotate(45 23 10)" fill="var(--marker-black)" stroke="var(--marker-stroke)" stroke-width="1.4" />
		</svg>
	{/if}
</span>

<style>
	.marker {
		display: inline-flex;
		align-items: center;
		line-height: 0;
		vertical-align: middle;
	}
	svg {
		display: block;
	}
</style>
