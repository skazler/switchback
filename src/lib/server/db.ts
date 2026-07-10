import { error } from '@sveltejs/kit';

/**
 * The D1 binding, or a 503 if it isn't available. Bindings only exist at
 * runtime on Workers (and in dev via wrangler) — never during prerender, so
 * only call this from non-prerendered server routes (/api/*).
 */
export function getDB(platform: App.Platform | undefined): D1Database {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Database unavailable — D1 binding not configured');
	return db;
}
