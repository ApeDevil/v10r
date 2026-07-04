/**
 * Client-side web-push subscription helpers. Permission is requested only from
 * an explicit user gesture (the settings toggle) — never on load; a wasted
 * early prompt is usually unrecoverable without the user digging through
 * browser settings.
 */

/** JSON API calls must carry x-requested-with — the CSRF hook 403s without it. */
const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };

function base64UrlToUint8Array(base64Url: string): Uint8Array {
	const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Current subscription for this device/browser, if any. */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
	if (!pushSupported()) return null;
	const registration = await navigator.serviceWorker.getRegistration();
	return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Subscribe this device. MUST be called from a user gesture.
 * Returns 'subscribed' | 'denied' | 'unsupported' | 'failed'.
 */
export async function subscribeToPush(): Promise<'subscribed' | 'denied' | 'unsupported' | 'failed'> {
	if (!pushSupported()) return 'unsupported';

	// getRegistration (not .ready): .ready never resolves when no worker is
	// registered (vite dev serves no SW) — fail fast instead of hanging.
	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration?.active) return 'failed';

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return 'denied';

	try {
		const keyRes = await fetch('/api/notifications/push', { headers: HEADERS });
		if (!keyRes.ok) return 'failed';
		const { publicKey } = (await keyRes.json()) as { publicKey: string };

		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToUint8Array(publicKey) as BufferSource,
		});

		const res = await fetch('/api/notifications/push', {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify(subscription.toJSON()),
		});
		if (!res.ok) {
			await subscription.unsubscribe().catch(() => {});
			return 'failed';
		}
		return 'subscribed';
	} catch {
		return 'failed';
	}
}

/** Unsubscribe this device (toggle off / sign-out hygiene). */
export async function unsubscribeFromPush(): Promise<void> {
	const subscription = await getCurrentPushSubscription().catch(() => null);
	if (!subscription) return;

	await fetch('/api/notifications/push', {
		method: 'DELETE',
		headers: HEADERS,
		body: JSON.stringify({ endpoint: subscription.endpoint }),
	}).catch(() => {});
	await subscription.unsubscribe().catch(() => {});
}
