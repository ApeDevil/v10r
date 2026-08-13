/**
 * SPA navigation beacon. Subscribes to SvelteKit's `afterNavigate`, queues
 * pageview events, and flushes the queue on `pagehide` via `navigator.sendBeacon`
 * with a `fetch keepalive` fallback. Idempotent: calling `initJourneyBeacon`
 * more than once is a no-op.
 *
 * CLIENT-SIDE NAVIGATIONS ONLY. `afterNavigate` also fires once after
 * hydration with `type: 'enter'` — for the very page load the server hook has
 * already recorded. Enqueuing it wrote every consented server-rendered load
 * twice (measured: 72 duplicate pairs in one production week), so `enter` is
 * skipped here and the confirm ping (`confirm-ping.ts`) covers that load
 * instead. The server filters `navigationType === 'enter'` as well, so a stale
 * cached client cannot reintroduce the double count.
 *
 * Every queued event carries a client-generated `eventId`, and the server holds
 * a unique index on it — so a re-delivered beacon, or SvelteKit firing
 * `afterNavigate` twice (sveltejs/kit#13573), collapses to one row instead of
 * double-counting.
 */

import { browser, dev } from '$app/environment';
import { afterNavigate } from '$app/navigation';
import { refireConfirm } from './confirm-ping';

interface QueuedEvent {
	eventId: string;
	path: string;
	referrer: string | null;
	occurredAt: string;
	/** Always 'spa' from this module — 'enter' loads are the server hook's row. */
	navigationType: 'spa';
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
		navigationType: 'spa',
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
	// Gated on `dev` for the same reason as `initTelemetry`: the dev server writes
	// to the production database, so local navigation was inflating real traffic.
	if (!browser || dev || initialized) return;
	initialized = true;

	afterNavigate(({ to, from, type }) => {
		// 'enter' is the initial hydration firing — that page load is already the
		// server hook's row. Only genuine client-side navigations belong here.
		if (!to || type === 'enter') return;
		enqueue(to.url.pathname, from?.url?.origin ?? (document.referrer ? new URL(document.referrer).origin : null));
	});

	// Back/forward cache restore. `afterNavigate` does NOT fire when the browser
	// serves a page from bfcache. A restore is deliberately NOT a pageview —
	// neither the server hook nor Vercel counts one, and this lane counting it
	// alone inflated the beacon numbers. It IS renewed presence, so it re-fires
	// the confirmation ping (a replay after the token's TTL is silently dropped
	// server-side; the session was confirmed on the original load).
	addEventListener('pageshow', (event) => {
		if (!event.persisted) return;
		refireConfirm();
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
