import { authClient } from '$lib/auth-client';
import { unsubscribeFromPush } from './push';

/**
 * Sign out + service-worker cache hygiene.
 *
 * The server already sends `Clear-Site-Data: "cache","cookies","storage"` on
 * sign-out (hooks.server.ts), but browsers honor it unevenly for Cache Storage.
 * Belt-and-braces: tell the worker to drop every non-current cache. Nothing
 * user-specific is ever cached by policy (see sw-policy.ts) — this defends the
 * invariant, it doesn't carry it.
 *
 * This device's push subscription is removed FIRST (needs the session): a
 * logged-out device must stop receiving pushes.
 */
export async function signOutAndFlush() {
	await unsubscribeFromPush().catch(() => {});
	await authClient.signOut();
	try {
		navigator.serviceWorker?.controller?.postMessage('FLUSH');
	} catch {
		// No worker registered (first visit, unsupported browser) — nothing to flush.
	}
}
