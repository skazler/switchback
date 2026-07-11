import { json } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { destroySession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ platform, cookies }) => {
	await destroySession(getDB(platform), cookies);
	return json({ ok: true });
};
