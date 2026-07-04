/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * v10r service worker — hand-rolled on SvelteKit's built-in `$service-worker`
 * module (no Workbox). This file is a showcase artifact: every decision is
 * commented because the pattern is meant to be copied.
 *
 * Caching contract (see $lib/pwa/sw-policy.ts for the enforced rules):
 * - Precache: the full hashed build + icons/manifest + the prerendered /offline
 *   page. The whole precache re-downloads once per deploy (SvelteKit's version
 *   is app-global — accepted cost; it happens in the background while the OLD
 *   worker keeps serving the old, self-consistent cache).
 * - HTML and __data.json are NEVER cached: every HTML response is personalized
 *   (palette injection) and data responses carry session state. Offline
 *   navigation falls back to the precached /offline page.
 * - /api/*, SSE, and non-GET requests are never intercepted at all.
 * - No automatic skipWaiting: the waiting worker activates only on user consent
 *   (UpdatePrompt) or when all tabs close. This is the deploy-skew protection —
 *   old tabs keep loading old chunks from the old cache.
 */

import { isImmutableAsset, mayCache, shouldHandle } from '$lib/pwa/sw-policy';
import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * KILL SWITCH — flip to true and deploy to evacuate every installed client:
 * next navigation re-fetches this file (served Cache-Control: no-cache),
 * the byte-diff installs it, all caches are wiped, the worker unregisters
 * itself, and open clients reload as plain browser tabs. Recovery lever for
 * a shipped-broken worker; leave false in normal operation.
 */
const KILL_SWITCH = false;

const CACHE = `cache-${version}`;

/** The prerendered offline fallback (built from src/routes/offline). */
const OFFLINE_URL = prerendered.find((path) => path.endsWith('/offline')) ?? '/offline';

/**
 * Precache set: hashed immutable build output, PWA icons + static essentials,
 * and the offline page. Deliberately EXCLUDES the big static payloads
 * (models/, blender-assets/, logo/, favicon.svg) — precaching 3D assets would
 * blow through iOS's cache budget for no offline value.
 */
const PRECACHE = [...build, ...files.filter((path) => path.startsWith('/icons/')), OFFLINE_URL];

sw.addEventListener('install', (event) => {
	if (KILL_SWITCH) {
		sw.skipWaiting();
		return;
	}
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

sw.addEventListener('activate', (event) => {
	if (KILL_SWITCH) {
		event.waitUntil(
			(async () => {
				for (const key of await caches.keys()) await caches.delete(key);
				await sw.registration.unregister();
				for (const client of await sw.clients.matchAll({ type: 'window' })) {
					client.navigate(client.url);
				}
			})(),
		);
		return;
	}
	event.waitUntil(
		(async () => {
			// Drop caches from previous deploys.
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			// Navigation preload: the browser starts the SSR request in parallel
			// with worker boot — the single best perf lever for an SSR app + SW.
			await sw.registration.navigationPreload?.enable();
		})(),
	);
});

/** Navigations: network (via preload) with the branded offline fallback. */
async function handleNavigation(event: FetchEvent): Promise<Response> {
	try {
		const preloaded = await event.preloadResponse;
		if (preloaded) return preloaded;
		return await fetch(event.request);
	} catch {
		// Network failure (offline) — NOT an HTTP error. Errors render normally.
		const cache = await caches.open(CACHE);
		const offline = await cache.match(OFFLINE_URL);
		return offline ?? Response.error();
	}
}

/** Immutable assets: cache-first; on miss, fetch and store (guarded). */
async function handleImmutable(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const hit = await cache.match(request);
	if (hit) return hit;
	const response = await fetch(request);
	if (mayCache(response)) cache.put(request, response.clone());
	return response;
}

sw.addEventListener('fetch', (event) => {
	if (KILL_SWITCH) return;
	const { request } = event;

	// Policy early-outs: non-GET, /api/* (SSE lives there), event-stream accepts.
	// Not intercepting is strictly safer than proxying — zero buffering risk.
	if (!shouldHandle(request)) return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(event));
		return;
	}

	if (isImmutableAsset(url)) {
		event.respondWith(handleImmutable(request));
		return;
	}

	// Precached static essentials (icons, offline page assets): cache-first.
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((hit) => hit ?? fetch(request))));
		return;
	}

	// Everything else — __data.json, fonts-by-query, uncached statics — goes
	// straight to the network with no respondWith. Nothing user-specific can
	// ever enter a cache because nothing else is ever written to one.
});

sw.addEventListener('message', (event) => {
	// User consented to the update prompt — activate the waiting worker.
	if (event.data === 'SKIP_WAITING') {
		sw.skipWaiting();
		return;
	}
	// Sign-out hygiene: drop any cache that isn't the current precache.
	// (The precache holds only anonymous build assets; authed content is
	// structurally never cached — this guards future runtime caches and
	// stale versions on browsers that ignore Clear-Site-Data.)
	if (event.data === 'FLUSH') {
		event.waitUntil?.(
			(async () => {
				for (const key of await caches.keys()) {
					if (key !== CACHE) await caches.delete(key);
				}
			})(),
		);
	}
});

/* ── Web push ──────────────────────────────────────────────────────────────
 * The server sends ONE payload shape: declarative-web-push JSON. Safari/iOS
 * 18.4+ renders it natively (this handler never runs there); Chrome/Android
 * delivers it as a classic push event, so this deliberately dumb handler
 * parses the same JSON and displays it. No fetches, no cache writes — push
 * context stays minimal by policy.
 */

interface DeclarativePush {
	web_push?: number;
	notification?: { title?: string; body?: string; navigate?: string; lang?: string };
}

sw.addEventListener('push', (event) => {
	const payload = ((): DeclarativePush | null => {
		try {
			return event.data?.json() ?? null;
		} catch {
			return null;
		}
	})();
	const notification = payload?.notification;

	// ALWAYS show something, even for a malformed payload: browsers penalize
	// "silent" pushes — iOS/WebKit revokes the subscription after repeated push
	// events with no showNotification(), Chrome shows a generic "site updated
	// in the background" notice. A bland fallback beats either.
	event.waitUntil(
		sw.registration.showNotification(notification?.title ?? 'v10r', {
			body: notification?.body,
			lang: notification?.lang,
			icon: '/icons/icon-192.png',
			data: { navigate: notification?.navigate ?? '/app/notifications' },
		}),
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const navigate: string = event.notification.data?.navigate ?? '/app/notifications';
	// Same-origin, path-only targets by contract (never attacker-derived URLs).
	if (!navigate.startsWith('/')) return;
	event.waitUntil(
		(async () => {
			const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const existing = clients.find((client) => new URL(client.url).origin === sw.location.origin);
			if (existing) {
				await existing.focus();
				await existing.navigate(navigate);
				return;
			}
			await sw.clients.openWindow(navigate);
		})(),
	);
});
