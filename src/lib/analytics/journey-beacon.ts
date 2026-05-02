/**
 * SPA navigation beacon. Subscribes to SvelteKit's `afterNavigate`, queues
 * pageview events, and flushes the queue on `pagehide` via `navigator.sendBeacon`
 * with a `fetch keepalive` fallback. Idempotent: calling `initJourneyBeacon`
 * more than once is a no-op.
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

function flush(): void {
	if (!queue.length) return;
	const batch = queue.splice(0, MAX_BATCH);
	const payload = JSON.stringify({ events: batch });
	const blob = new Blob([payload], { type: 'application/json' });

	const sent =
		typeof navigator !== 'undefined' && 'sendBeacon' in navigator ? navigator.sendBeacon(ENDPOINT, blob) : false;

	if (!sent) {
		// Best-effort fallback — keepalive lets the request survive page unload up to ~64KB.
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
		queue.push({
			eventId: crypto.randomUUID(),
			path: to.url.pathname,
			referrer: from?.url.origin ?? (document.referrer ? new URL(document.referrer).origin : null),
			occurredAt: new Date().toISOString(),
		});
		// Flush eagerly when the queue is full so we don't lose events to a sudden pagehide.
		if (queue.length >= MAX_BATCH) flush();
	});

	// Flush on tab close / hide. `pagehide` is more reliable than `beforeunload`.
	addEventListener('pagehide', flush);
	// Visibility change covers mobile background switches.
	addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush();
	});
}
