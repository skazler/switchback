<script lang="ts">
	// "Swap day" — a native select over every template day, grouped by program
	// (active first). Native so it's a proper picker on phones.
	import { onMount } from 'svelte';
	import { loadTemplates, type TemplatePick, type TemplateProgram } from '$lib/templates';

	let {
		onpick,
		label = 'Swap day',
		exclude
	}: {
		onpick: (pick: TemplatePick) => void;
		label?: string;
		/** program id + day slug currently shown, left out of the list */
		exclude?: { programId: string; slug: string };
	} = $props();

	let programs = $state<TemplateProgram[]>([]);
	let failed = $state(false);
	let value = $state('');

	onMount(async () => {
		try {
			programs = await loadTemplates();
		} catch {
			failed = true;
		}
	});

	const SEP = '\u0000';
	function choose() {
		if (!value) return;
		const [pid, slug] = value.split(SEP);
		value = '';
		const program = programs.find((p) => p.id === pid);
		const day = program?.days.find((d) => d.slug === slug);
		if (program && day) onpick({ program, day });
	}
</script>

<label class="swapday" id="swap">
	<span class="microlabel">⇄ {label}</span>
	<select bind:value onchange={choose} disabled={!programs.length}>
		<option value="">{failed ? 'Templates unavailable offline' : programs.length ? 'Pick any template day…' : 'Loading…'}</option>
		{#each programs as p (p.id)}
			<optgroup label={p.status === 'active' ? `${p.title} (current)` : p.title}>
				{#each p.days as d (d.slug)}
					{#if !(exclude && exclude.programId === p.id && exclude.slug === d.slug)}
						<option value={`${p.id}${SEP}${d.slug}`}>{d.code.toUpperCase()} · {d.label}</option>
					{/if}
				{/each}
			</optgroup>
		{/each}
	</select>
</label>

<style>
	.swapday {
		display: flex;
		align-items: center;
		gap: 12px;
		border: 1px solid var(--hairline);
		padding: 0 0 0 12px;
		min-height: var(--tap);
	}
	.swapday:focus-within {
		border-color: var(--blaze);
	}
	.swapday span {
		white-space: nowrap;
		color: var(--muted);
	}
	select {
		flex: 1;
		min-width: 0;
		align-self: stretch;
		background: transparent;
		color: var(--ink);
		border: none;
		border-radius: var(--radius);
		font-family: var(--font-body);
		font-size: 0.95rem;
		padding: 0 10px;
		cursor: pointer;
	}
	select:disabled {
		color: var(--muted);
		cursor: default;
	}
	select:focus {
		outline: none;
	}
	option,
	optgroup {
		background: var(--field-raised);
		color: var(--ink);
	}
</style>
