import { json, error } from '@sveltejs/kit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getDB } from '$lib/server/db';
import { rp, setChallenge, listCredentials, OWNER_USER_ID, OWNER_USER_NAME } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

// Step 1 of passkey registration. Gated by BOOTSTRAP_TOKEN (FLOWS §4) — the
// token's only use.
export const POST: RequestHandler = async ({ request, platform, cookies, url }) => {
	const db = getDB(platform);
	const { token } = ((await request.json().catch(() => ({}))) as { token?: string });
	const expected = platform?.env?.BOOTSTRAP_TOKEN;
	if (!expected) throw error(503, 'Registration disabled — BOOTSTRAP_TOKEN not set');
	if (token !== expected) throw error(403, 'Invalid bootstrap token');

	const { rpID, rpName } = rp(url);
	const existing = await listCredentials(db);
	const options = await generateRegistrationOptions({
		rpName,
		rpID,
		userID: OWNER_USER_ID,
		userName: OWNER_USER_NAME,
		attestationType: 'none',
		excludeCredentials: existing.map((c) => ({ id: c.id })),
		authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
	});
	setChallenge(cookies, options.challenge);
	return json(options);
};
