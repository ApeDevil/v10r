import { getClientIp } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk } from '$lib/server/api/response';
import { USERNAME_CHECK_RATE_LIMIT_MAX, USERNAME_CHECK_RATE_LIMIT_WINDOW } from '$lib/server/config';
import type { RequestHandler } from './$types';

const TAKEN_USERNAMES = ['admin', 'test', 'user', 'root', 'moderator', 'system'];

const limiter = createLimiter('rl:username:check', USERNAME_CHECK_RATE_LIMIT_MAX, USERNAME_CHECK_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async (event) => {
	const ip = getClientIp(event);
	if (ip) {
		const { success, reset } = await limiter.limit(ip);
		if (!success) return rateLimitResponse(reset);
	}

	const username = event.url.searchParams.get('u')?.toLowerCase() ?? '';

	// Simulated network delay (showcase demo only). Kept after the rate-limit so
	// it can't be used for cost amplification on Vercel function-time billing.
	await new Promise((r) => setTimeout(r, 300));

	const available = username.length >= 3 && !TAKEN_USERNAMES.includes(username);

	return apiOk({ available });
};
