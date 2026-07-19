import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth';

// Owner session gate (FLOWS §4). Validates the httpOnly session cookie against
// D1 and sets locals.owner. Runs for dynamic requests (/api/*); prerendered
// pages resolve owner state client-side via /api/auth/me. During prerender
// (`building`) the D1 binding is off-limits, so skip it.
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.owner = false;
	const db = building || !event.url.pathname.startsWith('/api/') ? undefined : event.platform?.env?.DB;
	if (db) {
		try {
			event.locals.owner = await validateSession(db, event.cookies.get(SESSION_COOKIE));
		} catch {
			event.locals.owner = false;
		}
	}
	return resolve(event);
};
