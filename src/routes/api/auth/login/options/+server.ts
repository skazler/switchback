import { json } from '@sveltejs/kit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getDB } from '$lib/server/db';
import { rp, setChallenge, listCredentials } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

// Step 1 of passkey assertion. No token — an existing credential is required.
export const POST: RequestHandler = async ({ platform, cookies, url }) => {
	const db = getDB(platform);
	const { rpID } = rp(url);
	const creds = await listCredentials(db);
	const options = await generateAuthenticationOptions({
		rpID,
		allowCredentials: creds.map((c) => ({ id: c.id })),
		userVerification: 'preferred'
	});
	setChallenge(cookies, options.challenge);
	return json(options);
};
