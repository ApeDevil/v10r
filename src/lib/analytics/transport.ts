/**
 * Shared beacon transport for both analytics queues.
 *
 * `sendBeacon` and `fetch(keepalive)` draw on the SAME ~64 KiB keepalive quota,
 * so the fallback is an alternative delivery path, not extra headroom — batches
 * are capped by count on the way in for exactly that reason.
 */

/**
 * Send a JSON payload without blocking unload. Returns nothing: beacon delivery
 * is unobservable by design, and a caller that branched on it would be acting on
 * a lie in the `sendBeacon` case.
 */
export function beacon(endpoint: string, payload: unknown): void {
	const body = JSON.stringify(payload);

	const sent =
		typeof navigator !== 'undefined' && 'sendBeacon' in navigator
			? navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
			: false;

	if (sent) return;

	fetch(endpoint, {
		method: 'POST',
		body,
		keepalive: true,
		headers: { 'Content-Type': 'application/json' },
	}).catch(() => {});
}
