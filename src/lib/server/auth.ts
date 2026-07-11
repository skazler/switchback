// Owner auth: WebAuthn passkey registration/assertion + opaque D1-backed
// sessions (FLOWS §4). Single owner; guests never authenticate.
import type { Cookies } from '@sveltejs/kit';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export const SESSION_COOKIE = 'sb_session';
export const CHALLENGE_COOKIE = 'sb_challenge';
const SESSION_DAYS = 90;

// Fixed single-user handle — there is exactly one owner.
export const OWNER_USER_ID = new TextEncoder().encode('switchback-owner');
export const OWNER_USER_NAME = 'owner';

/** Relying-party identity, derived from the request so it works on
 *  localhost and *.pages.dev alike. rpID must be the registrable domain. */
export function rp(url: URL) {
	return { rpID: url.hostname, origin: url.origin, rpName: 'Switchback' };
}

async function sha256b64url(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return isoBase64URL.fromBuffer(new Uint8Array(digest));
}

// ── WebAuthn challenge (short-lived httpOnly cookie between options→verify) ─
export function setChallenge(cookies: Cookies, challenge: string): void {
	cookies.set(CHALLENGE_COOKIE, challenge, { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 300 });
}
export function takeChallenge(cookies: Cookies): string | undefined {
	const c = cookies.get(CHALLENGE_COOKIE);
	cookies.delete(CHALLENGE_COOKIE, { path: '/' });
	return c;
}

// ── sessions ────────────────────────────────────────────────────────────
export async function createSession(db: D1Database, cookies: Cookies): Promise<void> {
	const token = isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(32)));
	const now = new Date();
	const expires = new Date(now.getTime() + SESSION_DAYS * 864e5);
	await db
		.prepare('INSERT INTO auth_sessions (token_hash, created_at, expires_at) VALUES (?1, ?2, ?3)')
		.bind(await sha256b64url(token), now.toISOString(), expires.toISOString())
		.run();
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		expires
	});
}

/** True if the request carries a valid, unexpired owner session. */
export async function validateSession(db: D1Database, token: string | undefined): Promise<boolean> {
	if (!token) return false;
	const row = await db
		.prepare('SELECT expires_at FROM auth_sessions WHERE token_hash = ?1')
		.bind(await sha256b64url(token))
		.first<{ expires_at: string }>();
	return !!row && new Date(row.expires_at) > new Date();
}

export async function destroySession(db: D1Database, cookies: Cookies): Promise<void> {
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		await db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?1').bind(await sha256b64url(token)).run();
		cookies.delete(SESSION_COOKIE, { path: '/' });
	}
}

// ── credentials ─────────────────────────────────────────────────────────
export interface StoredCredential {
	id: string; // base64url credential id
	publicKey: Uint8Array<ArrayBuffer>;
	counter: number;
}

export async function saveCredential(db: D1Database, cred: StoredCredential): Promise<void> {
	await db
		.prepare('INSERT OR REPLACE INTO credentials (id, public_key, counter, created_at) VALUES (?1, ?2, ?3, ?4)')
		.bind(cred.id, isoBase64URL.fromBuffer(cred.publicKey), cred.counter, new Date().toISOString())
		.run();
}

export async function listCredentials(db: D1Database): Promise<StoredCredential[]> {
	const { results } = await db.prepare('SELECT id, public_key, counter FROM credentials').all<{ id: string; public_key: string; counter: number }>();
	return (results ?? []).map((r) => ({ id: r.id, publicKey: new Uint8Array(isoBase64URL.toBuffer(r.public_key)), counter: r.counter }));
}

export async function getCredential(db: D1Database, id: string): Promise<StoredCredential | null> {
	const r = await db.prepare('SELECT id, public_key, counter FROM credentials WHERE id = ?1').bind(id).first<{ id: string; public_key: string; counter: number }>();
	return r ? { id: r.id, publicKey: new Uint8Array(isoBase64URL.toBuffer(r.public_key)), counter: r.counter } : null;
}

export async function updateCounter(db: D1Database, id: string, counter: number): Promise<void> {
	await db.prepare('UPDATE credentials SET counter = ?1 WHERE id = ?2').bind(counter, id).run();
}
