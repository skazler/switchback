// IndexedDB offline write-buffer (FLOWS §5/§6). Every session and set is
// written here first and lives here until /api/sync confirms it. This is the
// source of truth on-device; D1 is the durable copy. Works for guests too
// (they just never sync).

export interface PlannedExercise {
	exercise_id: string; // '' if unresolved in the library
	name: string;
	group?: string;
	sets?: string;
	reps?: string;
	rest?: string;
	notes?: string;
	week?: string; // "A" / "B" when the day has Week dividers
	choiceFor?: string; // the "… choice" row this was picked to satisfy
	format?: LogFormat; // inferred logging format
	extra?: boolean; // added mid-session, not part of the day's prescription
}

export type LogFormat = 'strength' | 'ride' | 'climb' | 'time';

export interface LocalSession {
	id: string;
	date: string; // ISO date (YYYY-MM-DD)
	program_id: string;
	day: string; // day label
	started_at: string; // ISO datetime
	completed_at?: string;
	notes?: string;
	planned: PlannedExercise[];
	synced: 0 | 1;
}

export interface LocalSet {
	id: string;
	session_id: string;
	exercise_id: string;
	performed_instead?: string;
	set_num?: number;
	reps?: number;
	weight?: number;
	unit?: string;
	rpe?: number;
	duration_s?: number;
	distance?: number; // miles (ride / run)
	grade?: string; // climbing grade, e.g. "V4"
	notes?: string;
	logged_at: string;
	synced: 0 | 1;
}

const DB_NAME = 'switchback';
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('sessions')) {
				db.createObjectStore('sessions', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('sets')) {
				const s = db.createObjectStore('sets', { keyPath: 'id' });
				s.createIndex('by_session', 'session_id');
				s.createIndex('by_exercise', 'exercise_id');
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx<T>(store: string | string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
	return open().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const t = db.transaction(store, mode);
				let out: IDBRequest<T> | void;
				t.oncomplete = () => resolve((out && 'result' in out ? out.result : undefined) as T);
				t.onerror = () => reject(t.error);
				out = fn(t);
			})
	);
}

const reqToPromise = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => ((r.onsuccess = () => res(r.result)), (r.onerror = () => rej(r.error))));

// ── sessions ──────────────────────────────────────────────────────────
export const putSession = (s: LocalSession) => tx('sessions', 'readwrite', (t) => t.objectStore('sessions').put(s));
export const getSession = (id: string) => tx<LocalSession | undefined>('sessions', 'readonly', (t) => t.objectStore('sessions').get(id) as IDBRequest<LocalSession | undefined>);

export async function allSessions(): Promise<LocalSession[]> {
	const db = await open();
	return reqToPromise(db.transaction('sessions', 'readonly').objectStore('sessions').getAll() as IDBRequest<LocalSession[]>);
}

/** Most recent still-open session (no completed_at), if any. */
export async function activeSession(): Promise<LocalSession | undefined> {
	const open = (await allSessions()).filter((s) => !s.completed_at);
	open.sort((a, b) => b.started_at.localeCompare(a.started_at));
	return open[0];
}

/** Delete a session and every set logged against it. */
export async function deleteSession(id: string): Promise<void> {
	const db = await open();
	const t = db.transaction(['sessions', 'sets'], 'readwrite');
	const setStore = t.objectStore('sets');
	const keys = await reqToPromise(setStore.index('by_session').getAllKeys(id) as IDBRequest<IDBValidKey[]>);
	for (const k of keys) setStore.delete(k);
	t.objectStore('sessions').delete(id);
	return new Promise((res, rej) => ((t.oncomplete = () => res()), (t.onerror = () => rej(t.error))));
}

// ── sets ──────────────────────────────────────────────────────────────
export const putSet = (s: LocalSet) => tx('sets', 'readwrite', (t) => t.objectStore('sets').put(s));
export const deleteSet = (id: string) => tx('sets', 'readwrite', (t) => t.objectStore('sets').delete(id));

export async function setsForSession(sessionId: string): Promise<LocalSet[]> {
	const db = await open();
	const idx = db.transaction('sets', 'readonly').objectStore('sets').index('by_session');
	const list = await reqToPromise(idx.getAll(sessionId) as IDBRequest<LocalSet[]>);
	return list.sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

/** Last recorded set for an exercise (for weight/reps prefill). */
export async function lastSetFor(exerciseId: string): Promise<LocalSet | undefined> {
	const db = await open();
	const idx = db.transaction('sets', 'readonly').objectStore('sets').index('by_exercise');
	const list = await reqToPromise(idx.getAll(exerciseId) as IDBRequest<LocalSet[]>);
	list.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
	return list[0];
}

// ── sync buffer ───────────────────────────────────────────────────────
export async function pending(): Promise<{ sessions: LocalSession[]; sets: LocalSet[] }> {
	const [ss, st] = await Promise.all([allSessions(), (async () => (await open()).transaction('sets', 'readonly').objectStore('sets').getAll())()]);
	const sets = await reqToPromise(st as IDBRequest<LocalSet[]>);
	return { sessions: ss.filter((s) => s.synced !== 1), sets: sets.filter((s) => s.synced !== 1) };
}

export async function markSynced(sessionIds: string[], setIds: string[]): Promise<void> {
	const db = await open();
	const t = db.transaction(['sessions', 'sets'], 'readwrite');
	const ss = t.objectStore('sessions');
	const st = t.objectStore('sets');
	for (const id of sessionIds) {
		const s = await reqToPromise(ss.get(id) as IDBRequest<LocalSession | undefined>);
		if (s) ss.put({ ...s, synced: 1 });
	}
	for (const id of setIds) {
		const s = await reqToPromise(st.get(id) as IDBRequest<LocalSet | undefined>);
		if (s) st.put({ ...s, synced: 1 });
	}
	return new Promise((res, rej) => ((t.oncomplete = () => res()), (t.onerror = () => rej(t.error))));
}

export async function clearAll(): Promise<void> {
	const db = await open();
	const t = db.transaction(['sessions', 'sets'], 'readwrite');
	t.objectStore('sessions').clear();
	t.objectStore('sets').clear();
	return new Promise((res, rej) => ((t.oncomplete = () => res()), (t.onerror = () => rej(t.error))));
}
