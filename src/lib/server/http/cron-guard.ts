/**
 * What every cron entry point checks before it runs anything.
 *
 * Limit BEFORE the secret compare, the way `/api/mcp/admin` does. A shared secret with
 * no bucket in front of it is an unbounded guessing surface, and the compare itself
 * costs a crypto op per attempt. Generous: Vercel's scheduler is the only legitimate
 * caller and it fires a couple of times a day — this bounds guessing, it does not shape
 * real traffic.
 */

import { timingSafeEqual } from 'node:crypto';
import { createLimiter, rateLimitResponse } from './rate-limit';
import { apiError } from './response';

const limiter = createLimiter('rl:cron', 20, '1 m');

function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Returns the response that ends the request (429 or 401), or null when the caller may
 * proceed. `secret` is the route's `env.CRON_SECRET` — passed in rather than read here so
 * the route file itself names the guard it relies on.
 */
export async function guardCronRequest(
	request: Request,
	clientKey: string,
	secret: string | undefined,
): Promise<Response | null> {
	const { success, reset } = await limiter.limit(clientKey);
	if (!success) return rateLimitResponse(reset);

	const auth = request.headers.get('authorization');
	if (!secret || !auth || !safeEqual(auth, `Bearer ${secret}`)) {
		return apiError(401, 'unauthorized', 'Unauthorized');
	}
	return null;
}
