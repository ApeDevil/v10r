import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { jobs } from '$lib/server/jobs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const secret = env.CRON_SECRET;
	const auth = request.headers.get('authorization');
	if (!secret || !auth || auth !== `Bearer ${secret}`) {
		error(401, 'Unauthorized');
	}

	const job = jobs[params.job];
	if (!job) {
		error(404, `Unknown job: ${params.job}`);
	}

	const result = await job.execute();
	return json({ success: true, deleted: result });
};
