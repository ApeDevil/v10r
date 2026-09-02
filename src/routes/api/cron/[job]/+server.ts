import { env } from '$env/dynamic/private';
import { normalizeIpKey } from '$lib/server/abuse';
import { guardCronRequest } from '$lib/server/http/cron-guard';
import { apiError, apiOk } from '$lib/server/http/response';
import { jobs } from '$lib/server/jobs';
import { runJob } from '$lib/server/jobs/runner';
import type { RequestHandler } from './$types';

/**
 * One job by slug — the door for external HTTP cron services and for re-running a
 * single job by hand. Vercel's own schedule goes through `/api/cron/due`, so that the
 * whole daily sweep wakes the database once instead of once per job.
 */

// Cron jobs (esp. dbops-refresh = Neon reset + catalog graph rebuild) far exceed
// the default. (60 = Hobby ceiling; raise to 300 on Pro for the heavy refresh job.)
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const GET: RequestHandler = async ({ request, params, locals }) => {
	const denied = await guardCronRequest(request, normalizeIpKey(locals.clientIp) ?? 'anon', env.CRON_SECRET);
	if (denied) return denied;

	// Object.hasOwn, not truthiness: a bare index lookup also finds inherited
	// members, so `constructor` / `toString` would pass this existence check.
	if (!Object.hasOwn(jobs, params.job)) {
		return apiError(404, 'unknown_job', `Unknown job: ${params.job}`);
	}

	const result = await runJob(params.job, 'cron');
	return apiOk(result);
};
