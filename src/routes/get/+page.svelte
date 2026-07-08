<script lang="ts">
	type Platform = 'android' | 'ios' | 'desktop' | 'unknown';

	let platform = $state<Platform>('unknown');
	let installed = $state(false);
	// Chromium fires beforeinstallprompt; we stash it to drive the button.
	let deferredPrompt = $state<Event & { prompt?: () => Promise<void> }>();

	$effect(() => {
		const ua = navigator.userAgent;
		if (/android/i.test(ua)) platform = 'android';
		else if (/iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua)))
			platform = 'ios';
		else platform = 'desktop';

		installed =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as unknown as { standalone?: boolean }).standalone === true;

		const onPrompt = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as Event & { prompt?: () => Promise<void> };
		};
		const onInstalled = () => (installed = true);
		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	async function install() {
		if (!deferredPrompt?.prompt) return;
		await deferredPrompt.prompt();
		deferredPrompt = undefined;
	}
</script>

<svelte:head>
	<title>Install · Switchback</title>
</svelte:head>

<p class="microlabel">Install</p>
<h1 class="display">Add to home screen</h1>

<div class="panel">
	{#if installed}
		<p class="lead">You're already running the installed app. 🏔️</p>
	{:else if platform === 'android'}
		<p class="lead">On Android, install it like a native app:</p>
		{#if deferredPrompt}
			<button class="btn-primary" onclick={install}>Install Switchback</button>
		{:else}
			<ol class="steps">
				<li>Open the browser menu (⋮).</li>
				<li>Tap <b>Install app</b> / <b>Add to Home screen</b>.</li>
			</ol>
		{/if}
	{:else if platform === 'ios'}
		<p class="lead">On iPhone / iPad, add it from Safari:</p>
		<ol class="steps">
			<li>Tap the <b>Share</b> button <span class="gl">⎋</span> in Safari.</li>
			<li>Scroll and tap <b>Add to Home Screen</b> <span class="gl">＋</span>.</li>
			<li>Tap <b>Add</b>. It opens full-screen, offline-ready.</li>
		</ol>
	{:else if platform === 'desktop'}
		<p class="lead">On desktop, just use the URL — or install it:</p>
		{#if deferredPrompt}
			<button class="btn-primary" onclick={install}>Install Switchback</button>
		{:else}
			<p class="muted">
				Look for the install icon in the address bar. Or simply bookmark this
				page — the app works the same in a tab.
			</p>
		{/if}
	{:else}
		<p class="lead muted">Detecting your device…</p>
	{/if}
</div>

<p class="foot microlabel muted">
	Switchback is a PWA: no app store, no account. It installs from the browser
	and runs offline once opened.
</p>

<style>
	h1 {
		margin-bottom: 20px;
	}
	.panel {
		border-left: 3px solid var(--blaze);
		background: var(--field-raised);
		padding: 18px 20px;
	}
	.lead {
		margin: 0 0 14px;
		font-size: 1.05rem;
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		line-height: 1.9;
	}
	.gl {
		font-family: var(--font-display);
		border: 0.5px solid var(--hairline);
		padding: 0 6px;
		margin: 0 2px;
	}
	.foot {
		margin-top: 20px;
		max-width: 52ch;
		line-height: 1.6;
	}
</style>
