/**
 * SPA navigation beacon. Subscribes to SvelteKit's `afterNavigate`, queues
 * pageview events, and flushes the queue on `pagehide` via `navigator.sendBeacon`
 * with a `fetch keepalive` fallback. Idempotent: calling `initJourneyBeacon`
 * more than once is a no-op.
 *
 * Every queued event carries a client-generated `eventId`, and the server holds
 * a unique index on it — so a re-delivered beacon, or SvelteKit firing
 * `afterNavigate` twice (sveltejs/kit#13573), collapses to one row instead of
 * double-counting.
 */

import { browser } from '$app/environment';
import { afterNavigate } from '$app/navigation';

interface QueuedEvent {
	eventId: string;
	path: string;
	referrer: string | null;
	occurredAt: string;
}

const ENDPOINT = '/api/analytics/journey';
const MAX_BATCH = 20;

let initialized = false;
const queue: QueuedEvent[] = [];

function enqueue(path: string, referrer: string | null): void {
	queue.push({
		eventId: crypto.randomUUID(),
		path,
		referrer,
		occurredAt: new Date().toISOString(),
	});
	// Flush eagerly when the queue is full so we don't lose events to a sudden pagehide.
	if (queue.length >= MAX_BATCH) flush();
}

function flush(): void {
	if (!queue.length) return;
	const batch = queue.splice(0, MAX_BATCH);
	const payload = JSON.stringify({ events: batch });
	const blob = new Blob([payload], { type: 'application/json' });

	const sent =
		typeof navigator !== 'undefined' && 'sendBeacon' in navigator ? navigator.sendBeacon(ENDPOINT, blob) : false;

	if (!sent) {
		// Best-effort fallback — keepalive lets the request survive page unload.
		// Both transports draw on the SAME ~64 KiB keepalive quota, so this is an
		// alternative delivery path, not extra headroom.
		fetch(ENDPOINT, {
			method: 'POST',
			body: payload,
			keepalive: true,
			headers: { 'Content-Type': 'application/json' },
		}).catch(() => {});
	}
}

export function initJourneyBeacon(): void {
	if (!browser || initialized) return;
	initialized = true;

	afterNavigate(({ to, from }) => {
		if (!to) return;
		enqueue(to.url.pathname, from?.url?.origin ?? (document.referrer ? new URL(document.referrer).origin : null));
	});

	// Back/forward cache restore. `afterNavigate` does NOT fire when the browser
	// serves a page from bfcache, so a back-navigation would otherwise be an
	// invisible pageview. `persisted` is what separates a restore from a normal
	// load (which afterNavigate already covers).
	addEventListener('pageshow', (event) => {
		if (!event.persisted) return;
		enqueue(location.pathname, document.referrer ? new URL(document.referrer).origin : null);
	});

	// Flush on tab close / hide. `pagehide` is more reliable than `beforeunload` —
	// and unlike `beforeunload`, merely registering it does not make the page
	// ineligible for bfcache.
	addEventListener('pagehide', flush);
	// Visibility change covers mobile background switches.
	addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush();
	});
}
