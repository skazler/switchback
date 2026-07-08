<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Summits · Switchback</title>
</svelte:head>

<p class="microlabel">Summits · PRs & goals</p>
<h1 class="display">Summit register</h1>

<section>
	<p class="microlabel sec">Achieved</p>
	<div class="empty muted">
		No summits logged yet — achieved PRs compute from logged sets once the
		logging client ships (milestone 4).
	</div>
</section>

<section>
	<p class="microlabel sec">Unclimbed</p>
	{#if data.goals.length > 0}
		<ol class="peaks">
			{#each data.goals as g}
				<li class="peak">
					<svg class="glyph" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
						<path d="M2 21 L12 4 L22 21 Z" fill="none" stroke="var(--muted)" stroke-width="1.6" />
					</svg>
					<span class="num numeral">{g.target}<span class="unit">{g.unit ?? 'lb'}</span></span>
					<span class="lift display">{g.exercise}</span>
					<span class="tag microlabel">unclimbed</span>
				</li>
			{/each}
		</ol>
	{:else}
		<div class="empty muted">
			No goals authored yet. Add them to <code>goals.yaml</code> in the repo:
			<pre>- exercise: clean
  target: 225
  unit: lb</pre>
		</div>
	{/if}
</section>

<style>
	h1 {
		margin-bottom: 22px;
	}
	.sec {
		color: var(--blaze);
		margin: 22px 0 8px;
	}
	:global([data-mode='paper']) .sec {
		color: var(--muted);
	}
	.empty {
		border-left: 3px solid var(--hairline);
		padding: 14px 18px;
		background: var(--field-raised);
		max-width: 52ch;
	}
	pre {
		margin: 8px 0 0;
		font-size: 0.8rem;
		white-space: pre-wrap;
	}
	.peaks {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.peak {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 4px;
		border-top: 0.5px solid var(--hairline);
	}
	.num {
		font-size: 1.8rem;
		font-weight: 600;
		min-width: 3.5ch;
	}
	.unit {
		font-size: 0.9rem;
		color: var(--muted);
		margin-left: 2px;
	}
	.lift {
		font-size: 1.3rem;
		text-transform: capitalize;
	}
	.tag {
		margin-left: auto;
		border: 0.5px solid var(--hairline);
		padding: 2px 7px;
	}
</style>
