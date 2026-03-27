/**
 * Fast-interval delivery scheduler — runs notification delivery at 15s intervals.
 * Separate from the main job scheduler which runs every 3 hours.
 */
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { DEFAULT_DELIVERY_INTERVAL_MS } from '$lib/server/config';
import { platform } from '$lib/server/platform';
import { notificationDelivery } from './notification-delivery';

declare global {
	var __v10r_delivery_scheduler: ReturnType<typeof setInterval> | undefined;
}

async function processDeliveries() {
	try {
		const count = await notificationDelivery();
		if (count > 0) {
			console.log(`[delivery-scheduler] Processed ${count} deliveries`);
		}
	} catch (err) {
		console.error('[delivery-scheduler] Error:', err);
	}
}

if (!building && platform.persistent && !globalThis.__v10r_delivery_scheduler) {
	const interval = Number(env.DELIVERY_INTERVAL_MS) || DEFAULT_DELIVERY_INTERVAL_MS;

	console.log(`[delivery-scheduler] Starting on ${platform.id} platform, interval: ${interval / 1000}s`);

	// Initial delay before first run
	setTimeout(processDeliveries, 3_000);

	const timer = setInterval(processDeliveries, interval);
	timer.unref();
	globalThis.__v10r_delivery_scheduler = timer;

	process.once('SIGTERM', () => {
		console.log('[delivery-scheduler] SIGTERM received, clearing interval');
		clearInterval(timer);
		globalThis.__v10r_delivery_scheduler = undefined;
	});
}
