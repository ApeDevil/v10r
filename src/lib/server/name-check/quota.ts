/**
 * Per-source daily counters, shared across instances.
 *
 * Rate limiting bounds one visitor; this bounds the deployment's spend on a free tier.
 * A spent counter is a coverage status, not a refusal — the check still runs every other
 * source and the exhausted one shows its manual link.
 *
 * Fails OPEN when Redis is missing or unreachable: the counter protects a vendor bill,
 * not a security boundary, and refusing every search because the counter is unreadable
 * would be the larger outage. The in-process map keeps dev and tests honest about the
 * limit without pretending to be shared.
 */
import { redis } from '$lib/server/cache';

const localCounts = new Map<string, { count: number; day: string }>();

/** Test seam. */
export function resetLocalQuota(): void {
	localCounts.clear();
}

function dayKey(now: Date): string {
	return now.toISOString().slice(0, 10);
}

export async function takeDailyQuota(sourceId: string, limit: number, now: Date = new Date()): Promise<boolean> {
	const day = dayKey(now);
	const key = `quota:name-check:${sourceId}:${day}`;

	if (redis) {
		try {
			const count = await redis.incr(key);
			// Only the first increment sets expiry; a two-day window survives clock skew
			// between instances without leaving keys behind.
			if (count === 1) await redis.expire(key, 2 * 24 * 60 * 60);
			return count <= limit;
		} catch (err) {
			console.error(
				`[name-check] quota counter unreadable for ${sourceId}, allowing:`,
				err instanceof Error ? err.name : err,
			);
			return true;
		}
	}

	const local = localCounts.get(key);
	const count = local && local.day === day ? local.count + 1 : 1;
	localCounts.set(key, { count, day });
	return count <= limit;
}
