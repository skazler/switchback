// Sync orchestration (FLOWS §6). Reactive state for the footer badge, plus the
// flush itself. Single writer, append-only, ULID-keyed → no conflict handling.
import { pending, markSynced } from './idb';

export const syncState = $state({
	pending: 0, // unsynced set count (the number the footer shows)
	syncing: false,
	owner: false,
	lastError: ''
});

export async function refreshPending(): Promise<void> {
	try {
		const { sets } = await pending();
		syncState.pending = sets.length;
	} catch {
		/* IndexedDB unavailable — leave as-is */
	}
}

/** Flush the buffer to D1. No-op offline or when nothing is pending. */
export async function syncNow(): Promise<void> {
	if (syncState.syncing || typeof navigator !== 'undefined' && !navigator.onLine) return;
	const batch = await pending();
	if (!batch.sessions.length && !batch.sets.length) {
		await refreshPending();
		return;
	}
	syncState.syncing = true;
	syncState.lastError = '';
	try {
		const res = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sessions: batch.sessions, sets: batch.sets })
		});
		if (res.status === 401) {
			// Not the owner (or session expired) — keep the buffer, no error noise.
			syncState.owner = false;
			return;
		}
		if (!res.ok) throw new Error(`sync ${res.status}`);
		const ack = (await res.json()) as { sessions: string[]; sets: string[] };
		await markSynced(ack.sessions, ack.sets);
		syncState.owner = true;
	} catch (e) {
		syncState.lastError = e instanceof Error ? e.message : 'sync failed';
	} finally {
		syncState.syncing = false;
		await refreshPending();
	}
}

let started = false;
/** Wire the sync triggers once, app-wide (called from the root layout). */
export function initSync(): void {
	if (started || typeof window === 'undefined') return;
	started = true;
	refreshPending();
	fetch('/api/auth/me', { method: 'POST' })
		.then((r) => r.json() as Promise<{ owner: boolean }>)
		.then((j) => {
			syncState.owner = j.owner;
			if (j.owner) syncNow();
		})
		.catch(() => {});
	addEventListener('online', () => syncNow());
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') syncNow();
	});
}
