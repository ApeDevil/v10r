import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { jobs } from '$lib/server/jobs';
import { runJob } from '$lib/server/jobs/runner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const secret = env.CRON_SECRET;
	const auth = request.headers.get('authorization');
	if (!secret || !auth || auth !== `Bearer ${secret}`) {
		error(401, 'Unauthorized');
	}

	if (!jobs[params.job]) {
		error(404, `Unknown job: ${params.job}`);
	}

	const result = await runJob(params.job, 'cron');
	return json(result);
};
