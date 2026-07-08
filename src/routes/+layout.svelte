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

	const nav = [
		{ href: '/route', label: 'Route' },
		{ href: '/library', label: 'Library' },
		{ href: '/summits', label: 'Summits' },
		{ href: '/log', label: 'Log' }
	];
</script>

<header class="topbar">
	<div class="wrap bar">
		<a class="brand" href="/" aria-label="Switchback — home">
			<img src="/logo.svg" alt="" width="26" height="26" />
			<span class="wordmark display">Switchback</span>
		</a>
		<nav class="nav">
			{#each nav as item}
				<a
					class="navlink microlabel"
					class:current={page.url.pathname === item.href ||
						(item.href !== '/' && page.url.pathname.startsWith(item.href))}
					href={item.href}>{item.label}</a
				>
			{/each}
			<button class="modebtn microlabel" onclick={toggleMode} aria-label="Toggle light / dark">
				{mode === 'dark' ? 'Paper' : 'Dark'}
			</button>
		</nav>
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
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.wordmark {
		font-size: 1.35rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.navlink,
	.modebtn {
		padding: 8px 10px;
		color: var(--muted);
	}
	.navlink:hover,
	.modebtn:hover {
		color: var(--ink);
	}
	.navlink.current {
		color: var(--ink);
	}
	.modebtn {
		background: none;
		border: 1px solid var(--hairline);
		cursor: pointer;
		min-height: 32px;
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
	@media (max-width: 520px) {
		.wordmark {
			display: none;
		}
		.navlink {
			padding: 8px 7px;
		}
	}
</style>
