import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { normalizeIpKey } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { jobs } from '$lib/server/jobs';
import { runJob } from '$lib/server/jobs/runner';
import type { RequestHandler } from './$types';

function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

// Generous: Vercel's scheduler is the only legitimate caller and it fires a
// handful of times a day. This bounds guessing, it does not shape real traffic.
const limiter = createLimiter('rl:cron', 20, '1 m');

// Cron jobs (esp. dbops-refresh = Neon reset + catalog graph rebuild) far exceed
// the default. (60 = Hobby ceiling; raise to 300 on Pro for the heavy refresh job.)
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const GET: RequestHandler = async ({ request, params, locals }) => {
	// Limit BEFORE the secret compare, the way /api/mcp/admin does. A shared
	// secret with no bucket in front of it is an unbounded guessing surface, and
	// the compare itself costs a crypto op per attempt.
	const { success, reset } = await limiter.limit(normalizeIpKey(locals.clientIp) ?? 'anon');
	if (!success) return rateLimitResponse(reset);

	const secret = env.CRON_SECRET;
	const auth = request.headers.get('authorization');
	if (!secret || !auth || !safeEqual(auth, `Bearer ${secret}`)) {
		return apiError(401, 'unauthorized', 'Unauthorized');
	}

	// Object.hasOwn, not truthiness: a bare index lookup also finds inherited
	// members, so `constructor` / `toString` would pass this existence check.
	if (!Object.hasOwn(jobs, params.job)) {
		return apiError(404, 'unknown_job', `Unknown job: ${params.job}`);
	}

	const result = await runJob(params.job, 'cron');
	return apiOk(result);
};
