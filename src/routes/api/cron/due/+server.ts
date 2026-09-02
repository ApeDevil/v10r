import { env } from '$env/dynamic/private';
import { normalizeIpKey } from '$lib/server/abuse';
import { guardCronRequest } from '$lib/server/http/cron-guard';
import { apiOk } from '$lib/server/http/response';
import { jobsDueOn } from '$lib/server/jobs';
import { type JobResult, runJob } from '$lib/server/jobs/runner';
import type { RequestHandler } from './$types';

/**
 * Everything due today, in registry order, in one invocation.
 *
 * Vercel's scheduler used to hit `/api/cron/[job]` once per job, spread across the
 * morning. Each call woke a suspended Neon endpoint for seconds of work and then paid
 * its 5-minute idle minimum — thirteen wakes a day for a handful of DELETEs. One sweep
 * is one wake. Hobby quantizes cron timing by up to an hour, so staggering entries can
 * never be relied on to coalesce them; running them from one handler can.
 *
 * Sequential, not parallel: the registry order carries dependencies (the digest builds
 * the rows the delivery drains), and every job here finishes in under four seconds
 * (`jobs.job_execution` is the evidence). The one job that does not — the ~45 s
 * `bot-ranges-refresh` — is marked `standalone` and keeps its own cron entry.
 */

export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const GET: RequestHandler = async ({ request, locals }) => {
	const denied = await guardCronRequest(request, normalizeIpKey(locals.clientIp) ?? 'anon', env.CRON_SECRET);
	if (denied) return denied;

	const results: JobResult[] = [];
	for (const slug of jobsDueOn(new Date())) {
		results.push(await runJob(slug, 'cron'));
	}

	return apiOk({
		ran: results.length,
		failed: results.filter((r) => r.status === 'failure').length,
		results,
	});
};
