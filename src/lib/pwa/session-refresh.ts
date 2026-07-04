/**
 * Wake-time session revalidation. Two staleness mechanisms exist:
 *  1. bfcache restore (back-button into the app) — page.data predates a
 *     login/logout that happened meanwhile.
 *  2. Installed PWA: OAuth / magic-link completes in the system browser; the
 *     PWA window never navigates and keeps a logged-out shell until reload.
 * Idempotent: calling `initSessionRefresh` more than once is a no-op. Zero
 * work for ordinary visitors (no pending-login marker, no bfcache restore).
 */

import { browser } from '$app/environment';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';

const MARKER_KEY = 'v10r:auth-pending';
const MARKER_TTL_MS = 10 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 5_000;

let initialized = false;
let lastRefresh = 0;

/** Flag that a login was started whose completion happens outside this window. */
export function setAuthPendingMarker(): void {
	try {
		localStorage.setItem(MARKER_KEY, String(Date.now()));
	} catch {}
}

export function clearAuthPendingMarker(): void {
	try {
		localStorage.removeItem(MARKER_KEY);
	} catch {}
}

function markerFresh(): boolean {
	try {
		const raw = localStorage.getItem(MARKER_KEY);
		if (!raw) return false;
		if (Date.now() - Number(raw) > MARKER_TTL_MS) {
			localStorage.removeItem(MARKER_KEY);
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

async function refresh(): Promise<void> {
	const now = Date.now();
	if (now - lastRefresh < MIN_REFRESH_INTERVAL_MS) return;
	lastRefresh = now;
	await invalidateAll();
	if (page.data.session) clearAuthPendingMarker(); // login landed — done
}

function onWake(): void {
	if (page.data.session) {
		clearAuthPendingMarker(); // already fresh
		return;
	}
	if (!markerFresh()) return; // no pending login → free path for anonymous users
	void refresh();
}

export function initSessionRefresh(): void {
	if (!browser || initialized) return;
	initialized = true;

	// bfcache restore: ALWAYS revalidate — covers stale logged-out AND stale
	// logged-in (sign-out in another tab; Clear-Site-Data does not evict the
	// bfcache in every browser).
	window.addEventListener('pageshow', (e) => {
		if (e.persisted) void refresh();
	});
	window.addEventListener('focus', onWake);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') onWake();
	});
}
