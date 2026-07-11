import { json } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { listCredentials } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

// Client-side owner-state probe (pages are prerendered, so UI can't read
// locals). Also reports whether any credential exists, so /auth can offer
// "sign in" vs "register this device".
export const POST: RequestHandler = async ({ locals, platform }) => {
	let registered = false;
	try {
		registered = (await listCredentials(getDB(platform))).length > 0;
	} catch {
		registered = false;
	}
	return json({ owner: locals.owner, registered });
};

export const GET: RequestHandler = async ({ locals }) => json({ owner: locals.owner });
