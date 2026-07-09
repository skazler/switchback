<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · Switchback</title>
</svelte:head>

<div class="err">
	<p class="code numeral">{page.status}</p>
	<h1 class="display">{page.error?.message ?? 'Off the map'}</h1>
	<p class="muted">This trail doesn't go anywhere.</p>
	<a class="btn-ghost" href="/">← Back to the trailhead</a>
</div>

<style>
	.err {
		padding: 40px 0;
	}
	.code {
		font-family: var(--font-display);
		font-size: 4rem;
		color: var(--blaze);
		line-height: 1;
	}
	h1 {
		margin: 6px 0 10px;
	}
	.btn-ghost {
		margin-top: 16px;
	}
</style>
