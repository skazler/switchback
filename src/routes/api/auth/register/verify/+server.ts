import { json, error } from '@sveltejs/kit';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { getDB } from '$lib/server/db';
import { rp, takeChallenge, saveCredential, createSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

// Step 2 of passkey registration: verify the attestation, store the credential,
// and establish the owner session.
export const POST: RequestHandler = async ({ request, platform, cookies, url }) => {
	const db = getDB(platform);
	const challenge = takeChallenge(cookies);
	if (!challenge) throw error(400, 'No pending challenge');
	const body = (await request.json()) as RegistrationResponseJSON;
	const { rpID, origin } = rp(url);

	const { verified, registrationInfo } = await verifyRegistrationResponse({
		response: body,
		expectedChallenge: challenge,
		expectedOrigin: origin,
		expectedRPID: rpID
	});
	if (!verified || !registrationInfo) throw error(400, 'Registration failed');

	const { credential } = registrationInfo;
	await saveCredential(db, { id: credential.id, publicKey: new Uint8Array(credential.publicKey), counter: credential.counter });
	await createSession(db, cookies);
	return json({ verified: true });
};
