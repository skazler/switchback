import type { Handle } from '@sveltejs/kit';

// Owner session gate. M3-1 stub — always guest; M3-2 (WebAuthn) verifies the
// signed session cookie here and sets locals.owner = true for the owner.
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.owner = false;
	return resolve(event);
};
