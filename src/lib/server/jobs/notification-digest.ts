/**
 * notification-digest — build batched digests for daily and weekly subscribers.
 *
 * ONE job covers both frequencies because Vercel Hobby rejects sub-daily crons
 * and every slot is scarce: `weekly` is gated in code by its 7-day window, which
 * simply matches no one on six days out of seven.
 *
 * Scheduled BEFORE the outbox drain (`0 7` vs `0 8`) so the rows it writes are
 * picked up the same morning — though with ±59min jitter on both, that ordering
 * is a preference, not a guarantee.
 *
 * Returns the number of digests enqueued, which is the `job_execution` row count.
 */
import { runDigest } from '$lib/server/notifications/digest';

export async function notificationDigest(): Promise<number> {
	let total = 0;

	for (const frequency of ['daily', 'weekly'] as const) {
		const result = await runDigest(frequency);
		if (result.claimed > 0) {
			console.info(
				`[notification-digest] ${frequency}: claimed=${result.claimed} sent=${result.sent} empty=${result.empty} failed=${result.failed}`,
			);
		}
		total += result.sent;
	}

	return total;
}
