<script lang="ts">
	// Trailhead wayfinding sign (DESIGN concept 3): full-width bar, condensed
	// label left, → right. Today's session is the one blaze-filled sign.
	let {
		href,
		label,
		meta,
		active = false
	}: { href: string; label: string; meta?: string; active?: boolean } = $props();
</script>

<a class="sign" class:active href={href}>
	<span class="label display">{label}</span>
	{#if meta}<span class="meta microlabel">{meta}</span>{/if}
	<span class="arrow" aria-hidden="true">→</span>
</a>

<style>
	.sign {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--tap);
		padding: 12px 16px;
		border: 1px solid var(--hairline);
		margin-top: -1px; /* collapse borders into a stack */
	}
	.sign:hover {
		border-color: var(--ink);
	}
	.sign.active {
		background: var(--blaze);
		border-color: var(--blaze);
		color: var(--on-blaze);
	}
	.sign.active:hover {
		background: var(--blaze-lit);
	}
	.label {
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}
	.meta {
		margin-left: auto;
	}
	.sign.active .meta {
		color: var(--on-blaze);
		opacity: 0.85;
	}
	.arrow {
		font-family: var(--font-display);
		font-size: 1.4rem;
		margin-left: 8px;
	}
	.meta + .arrow {
		margin-left: 8px;
	}
	.sign:not(:has(.meta)) .arrow {
		margin-left: auto;
	}
</style>
