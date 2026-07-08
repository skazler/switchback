<script lang="ts">
	// M2 renders the shell; session history lands with the logging client (M3),
	// backed by D1. Privacy rules (FLOWS §2/§8) apply once there's data.
</script>

<svelte:head>
	<title>Log · Switchback</title>
</svelte:head>

<p class="microlabel">Log · session history</p>
<h1 class="display">Log</h1>

<div class="empty">
	<p>No sessions yet.</p>
	<p class="muted">
		The logging client — offline-capable, synced to D1 — arrives in milestone 3.
		Until then this is the trailhead for a history that hasn't been walked.
	</p>
	<a class="btn-ghost" href="/route">Go to the route →</a>
</div>

<style>
	h1 {
		margin-bottom: 20px;
	}
	.empty {
		border-left: 3px solid var(--hairline);
		padding: 16px 20px;
		background: var(--field-raised);
	}
	.empty p {
		margin: 0 0 10px;
		max-width: 46ch;
	}
	.btn-ghost {
		margin-top: 8px;
	}
</style>
