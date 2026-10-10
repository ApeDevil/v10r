import { discardUnsavedWork, type UnsavedWork } from '$lib/state/unsaved-work';
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
 *
 * `unsavedWork` is what the caller has already drained and the user has agreed to
 * lose (`$lib/state/unsaved-work.ts`). It is erased only once the server confirmed
 * the sign-out — a failed sign-out leaves the user signed in, with their work.
 * Returns whether the sign-out succeeded.
 *
 * The auth client is imported on call: this module sits in the user menu, which
 * every page's shell renders, and the client is only needed at the moment of sign-out.
 */
export async function signOutAndFlush(unsavedWork: readonly UnsavedWork[] = []): Promise<boolean> {
	await unsubscribeFromPush().catch(() => {});
	const { authClient } = await import('$lib/auth-client');
	const { error } = await authClient.signOut();
	if (error) return false;
	discardUnsavedWork(unsavedWork);
	try {
		navigator.serviceWorker?.controller?.postMessage('FLUSH');
	} catch {
		// No worker registered (first visit, unsupported browser) — nothing to flush.
	}
	return true;
}
