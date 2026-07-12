// Sync orchestration (FLOWS §6). Reactive state for the footer badge, plus the
// flush itself. Single writer, append-only, ULID-keyed → no conflict handling.
import { pending, markSynced, deleteSet, deleteSession } from './idb';

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

let inFlight: Promise<void> | null = null;

/** Flush the buffer to D1. No-op offline. Safe to call concurrently — a
 *  caller during an in-flight flush awaits that flush instead of no-op'ing,
 *  and the flush loops until the buffer (as of when it's read) is empty, so
 *  a session update written just before syncNow() (e.g. finishing notes)
 *  is never silently dropped by an overlapping call. */
export function syncNow(): Promise<void> {
	if (inFlight) return inFlight;
	if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve();
	inFlight = runSync().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

async function runSync(): Promise<void> {
	syncState.syncing = true;
	syncState.lastError = '';
	try {
		let batch = await pending();
		while (batch.sessions.length || batch.sets.length) {
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
			batch = await pending();
		}
	} catch (e) {
		syncState.lastError = e instanceof Error ? e.message : 'sync failed';
	} finally {
		syncState.syncing = false;
		await refreshPending();
	}
}

/** Delete a set locally and, best-effort, from D1 (owner + online). */
export async function removeSet(id: string): Promise<void> {
	await deleteSet(id);
	await refreshPending();
	if (syncState.owner && (typeof navigator === 'undefined' || navigator.onLine)) {
		fetch('/api/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ deleteSets: [id] })
		}).catch(() => {});
	}
}

/** Delete a whole session (and its sets) locally and, best-effort, from D1. */
export async function removeSession(id: string): Promise<void> {
	await deleteSession(id);
	await refreshPending();
	if (syncState.owner && (typeof navigator === 'undefined' || navigator.onLine)) {
		fetch('/api/sync', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ deleteSessions: [id] })
		}).catch(() => {});
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
