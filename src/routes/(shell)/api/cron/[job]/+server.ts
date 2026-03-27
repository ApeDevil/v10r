import { timingSafeEqual } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
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
		error(401, 'Unauthorized');
	}

	if (!jobs[params.job]) {
		error(404, `Unknown job: ${params.job}`);
	}

	const result = await runJob(params.job, 'cron');
	return json(result);
};
