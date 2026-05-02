import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
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

export const GET: RequestHandler = async ({ request, params }) => {
	const secret = env.CRON_SECRET;
	const auth = request.headers.get('authorization');
	if (!secret || !auth || !safeEqual(auth, `Bearer ${secret}`)) {
		return apiError(401, 'unauthorized', 'Unauthorized');
	}

	if (!jobs[params.job]) {
		return apiError(404, 'unknown_job', `Unknown job: ${params.job}`);
	}

	const result = await runJob(params.job, 'cron');
	return apiOk(result);
};
