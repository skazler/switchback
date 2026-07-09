<script lang="ts">
	import '@fontsource/barlow-condensed/500.css';
	import '@fontsource/barlow-condensed/600.css';
	import '@fontsource/archivo/400.css';
	import '@fontsource/archivo/500.css';
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	let mode = $state<'dark' | 'paper'>('dark');

	$effect(() => {
		mode = (document.documentElement.getAttribute('data-mode') as 'dark' | 'paper') ?? 'dark';
	});

	function toggleMode() {
		mode = mode === 'dark' ? 'paper' : 'dark';
		document.documentElement.setAttribute('data-mode', mode);
		try {
			localStorage.setItem('mode', mode);
		} catch {
			/* private mode — ignore */
		}
	}

	// Context "up" target so mobile / installed-PWA users (no browser chrome)
	// always have a reliable way back. Parent = one path segment up.
	const PARENT_LABEL: Record<string, string> = {
		'': 'Trailhead',
		route: 'Route',
		routes: 'Programs'
	};
	const back = $derived.by(() => {
		const path = page.url.pathname.replace(/\/+$/, '');
		if (path === '' || path === '/') return null;
		const segs = path.split('/').filter(Boolean);
		segs.pop();
		const parentKey = segs[segs.length - 1] ?? '';
		return { href: '/' + segs.join('/'), label: PARENT_LABEL[parentKey] ?? 'Trailhead' };
	});
</script>

<header class="topbar">
	<div class="wrap bar">
		<div class="left">
			{#if back}
				<a class="back" href={back.href} aria-label="Back to {back.label}">
					<span class="chev" aria-hidden="true">‹</span><span class="backlabel">{back.label}</span>
				</a>
			{/if}
			<a class="brand" href="/" aria-label="Switchback — home">
				<img src="/logo.svg" alt="" width="24" height="24" />
				<span class="wordmark display">Switchback</span>
			</a>
		</div>
		<button class="modebtn microlabel" onclick={toggleMode} aria-label="Toggle light / dark">
			{mode === 'dark' ? 'Paper' : 'Dark'}
		</button>
	</div>
	<hr class="rule" />
</header>

<main class="wrap page">
	{@render children()}
</main>

<footer class="footer">
	<hr class="rule" />
	<div class="wrap bar">
		<span class="microlabel">Switchback</span>
		<span class="microlabel muted">Plain-text training substrate</span>
	</div>
</footer>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--field);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 52px;
		gap: 16px;
	}
	.left {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 44px;
		padding-right: 6px;
		color: var(--muted);
	}
	.back:hover {
		color: var(--blaze);
	}
	.chev {
		font-family: var(--font-display);
		font-size: 1.8rem;
		line-height: 1;
		margin-top: -2px;
	}
	.backlabel {
		font-family: var(--font-body);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
	}
	.wordmark {
		font-size: 1.3rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.modebtn {
		background: none;
		border: 1px solid var(--hairline);
		cursor: pointer;
		min-height: 32px;
		padding: 6px 10px;
		color: var(--muted);
	}
	.modebtn:hover {
		color: var(--ink);
	}
	.page {
		padding-top: 22px;
		padding-bottom: 48px;
		min-height: 70vh;
	}
	.footer {
		margin-top: 40px;
	}
	.footer .bar {
		min-height: 44px;
	}
	/* On a narrow phone: keep the back chevron + label; drop the wordmark so
	   the back affordance stays prominent. Logo mark still links home. */
	@media (max-width: 520px) {
		.wordmark {
			display: none;
		}
	}
</style>
