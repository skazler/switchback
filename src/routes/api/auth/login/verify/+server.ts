import { json, error } from '@sveltejs/kit';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getDB } from '$lib/server/db';
import { rp, takeChallenge, getCredential, updateCounter, createSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

// Step 2 of passkey assertion: verify against the stored credential, bump the
// signature counter, establish the owner session.
export const POST: RequestHandler = async ({ request, platform, cookies, url }) => {
	const db = getDB(platform);
	const challenge = takeChallenge(cookies);
	if (!challenge) throw error(400, 'No pending challenge');
	const body = (await request.json()) as AuthenticationResponseJSON;
	const cred = await getCredential(db, body.id);
	if (!cred) throw error(400, 'Unknown credential');
	const { rpID, origin } = rp(url);

	const { verified, authenticationInfo } = await verifyAuthenticationResponse({
		response: body,
		expectedChallenge: challenge,
		expectedOrigin: origin,
		expectedRPID: rpID,
		credential: { id: cred.id, publicKey: cred.publicKey, counter: cred.counter }
	});
	if (!verified) throw error(400, 'Assertion failed');

	await updateCounter(db, cred.id, authenticationInfo.newCounter);
	await createSession(db, cookies);
	return json({ verified: true });
};
