<script lang="ts">
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
	import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
	import { onMount } from 'svelte';

	let registered = $state<boolean | null>(null); // null = unknown yet
	let owner = $state(false);
	let token = $state('');
	let busy = $state(false);
	let msg = $state('');
	let err = $state('');

	onMount(async () => {
		try {
			const j = (await (await fetch('/api/auth/me', { method: 'POST' })).json()) as { owner: boolean; registered: boolean };
			owner = j.owner;
			registered = j.registered;
		} catch {
			registered = false;
		}
	});

	async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
		const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
		if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message || `HTTP ${r.status}`);
		return r.json() as Promise<T>;
	}

	async function register() {
		err = msg = '';
		busy = true;
		try {
			const options = await post<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/options', { token: token.trim() });
			const att = await startRegistration({ optionsJSON: options });
			await post('/api/auth/register/verify', att);
			owner = true;
			registered = true;
			msg = 'This device is now your passkey. You are signed in.';
		} catch (e) {
			err = e instanceof Error ? e.message : 'Registration failed';
		} finally {
			busy = false;
		}
	}

	async function signIn() {
		err = msg = '';
		busy = true;
		try {
			const options = await post<PublicKeyCredentialRequestOptionsJSON>('/api/auth/login/options');
			const asr = await startAuthentication({ optionsJSON: options });
			await post('/api/auth/login/verify', asr);
			owner = true;
			msg = 'Signed in.';
		} catch (e) {
			err = e instanceof Error ? e.message : 'Sign-in failed';
		} finally {
			busy = false;
		}
	}

	async function signOut() {
		await post('/api/auth/logout');
		owner = false;
		msg = 'Signed out.';
	}
</script>

<svelte:head><title>Owner · Switchback</title></svelte:head>

<p class="microlabel">Owner · passkey</p>
<h1 class="display">Owner sign-in</h1>

{#if owner}
	<div class="panel">
		<p>You're signed in as the owner. Sessions you log will sync to the server.</p>
		<button class="btn-ghost" onclick={signOut} disabled={busy}>Sign out</button>
	</div>
{:else}
	<div class="panel">
		{#if registered}
			<p>Use your passkey to sign in on this device.</p>
			<button class="btn-primary" onclick={signIn} disabled={busy}>Sign in with passkey</button>
			<details>
				<summary class="muted">Register a new device</summary>
				{@render regForm()}
			</details>
		{:else}
			<p>Register this device as the owner. Requires the bootstrap token.</p>
			{@render regForm()}
		{/if}
	</div>
{/if}

{#snippet regForm()}
	<div class="reg">
		<label class="microlabel" for="tok">Bootstrap token</label>
		<input id="tok" type="password" bind:value={token} autocomplete="off" placeholder="from Cloudflare secret" />
		<button class="btn-primary" onclick={register} disabled={busy || !token.trim()}>Register this device</button>
	</div>
{/snippet}

{#if msg}<p class="ok">{msg}</p>{/if}
{#if err}<p class="err">{err}</p>{/if}

<p class="muted foot">Guests don't need this — every plan and the library are public. Only logging to the server needs the owner passkey.</p>

<style>
	h1 {
		margin-bottom: 20px;
	}
	.panel {
		border-left: 3px solid var(--blaze);
		padding: 16px 20px;
		background: var(--field-raised);
	}
	.panel p {
		margin: 0 0 14px;
		max-width: 48ch;
	}
	.reg {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 320px;
	}
	input {
		background: var(--field);
		border: 1px solid var(--hairline);
		color: var(--ink);
		padding: 10px 12px;
		font-family: var(--font-body);
		font-size: 1rem;
	}
	.btn-primary {
		background: var(--blaze);
		color: var(--field);
		border: none;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1rem;
		letter-spacing: 0.03em;
		padding: 11px 18px;
		cursor: pointer;
		align-self: flex-start;
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: default;
	}
	details {
		margin-top: 16px;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
	}
	details .reg {
		margin-top: 12px;
	}
	.ok {
		color: var(--blaze);
		margin-top: 16px;
	}
	.err {
		color: #d64545;
		margin-top: 16px;
	}
	.foot {
		margin-top: 28px;
		max-width: 52ch;
		font-size: 0.85rem;
	}
</style>
