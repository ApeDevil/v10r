import { desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { jobs } from '$lib/server/jobs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const registeredJobs = Object.keys(jobs);

	const recentExecutions = await db.select().from(jobExecution).orderBy(desc(jobExecution.startedAt)).limit(10);

	return {
		title: 'Jobs - Showcases',
		registeredJobs,
		recentExecutions: recentExecutions.map((e) => ({
			...e,
			startedAt: e.startedAt.toISOString(),
			finishedAt: e.finishedAt.toISOString(),
		})),
	};
};
