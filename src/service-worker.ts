/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Minimal service worker for M2: precache the app shell so the PWA is
// installable and cold-opens instantly. The full offline strategy
// (stale-while-revalidate content, network-first API, buffered sync)
// lands in M3 per FLOWS §10.

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `switchback-${version}`;

// Precache built assets + static files. Content JSON is baked into the
// prerendered pages for M2, so the shell is enough.
const PRECACHE = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	// Never cache API responses here — M3 owns that policy.
	if (url.pathname.startsWith('/api/')) return;

	// Cache-first for precached build assets (hashed, immutable).
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => cached ?? fetch(request))
		);
		return;
	}

	// Stale-while-revalidate for navigations and everything else.
	event.respondWith(
		caches.open(CACHE).then(async (cache) => {
			const cached = await cache.match(request);
			const network = fetch(request)
				.then((response) => {
					if (response.ok) cache.put(request, response.clone());
					return response;
				})
				.catch(() => cached);
			return cached ?? network;
		})
	);
});
