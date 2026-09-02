/**
 * Fast-interval delivery scheduler — runs notification delivery at 15s intervals.
 * Separate from the main job scheduler which runs every 3 hours.
 */
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { DEFAULT_DELIVERY_INTERVAL_MS } from '$lib/server/notifications/config';
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

// Dev is muted for the same reason as `scheduler.ts`: the dev container counts as
// a persistent platform, and this loop hits the ONE production database every
// 15 seconds — two UPDATE … RETURNING statements per tick, queue empty or not —
// which never lets the Neon endpoint reach its 5-minute scale-to-zero. That alone
// kept it awake ~20 h/day in August 2026 and exhausted the Free compute quota.
// JOBS_DEV_ENABLED='true' re-enables it for deliberately testing delivery locally.
if (!building && dev && env.JOBS_DEV_ENABLED !== 'true' && platform.persistent) {
	console.log(
		'[delivery-scheduler] Muted in dev (set JOBS_DEV_ENABLED=true to drain the outbox against the shared DB)',
	);
}

if (
	!building &&
	platform.persistent &&
	(!dev || env.JOBS_DEV_ENABLED === 'true') &&
	!globalThis.__v10r_delivery_scheduler
) {
	const interval = Number(env.DELIVERY_INTERVAL_MS) || DEFAULT_DELIVERY_INTERVAL_MS;

	console.log(`[delivery-scheduler] Starting on ${platform.id} platform, interval: ${interval / 1000}s`);

	// Initial delay before first run
	setTimeout(processDeliveries, 3_000);

	const timer = setInterval(processDeliveries, interval);
	timer.unref();
	globalThis.__v10r_delivery_scheduler = timer;

	process.on('SIGTERM', () => {
		console.log('[delivery-scheduler] SIGTERM received, clearing interval');
		clearInterval(timer);
		globalThis.__v10r_delivery_scheduler = undefined;
	});
}
