import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { safeDeferPromise } from '$lib/server/http/defer';
import { scheduledRetentionRows } from '$lib/server/showcases/privacy/retention-copy';
import type { PageServerLoad } from './$types';

async function getLastJobRun(slug: string) {
	const rows = await db
		.select({
			startedAt: jobExecution.startedAt,
			status: jobExecution.status,
			resultCount: jobExecution.resultCount,
		})
		.from(jobExecution)
		.where(eq(jobExecution.jobSlug, slug))
		.orderBy(desc(jobExecution.startedAt))
		.limit(1);

	// .at(0) keeps the | undefined arm so the ?? null actually types as nullable
	// (plain rows[0] erases it without noUncheckedIndexedAccess).
	return rows.at(0) ?? null;
}

export const load: PageServerLoad = async () => {
	return {
		title: 'Retention — Admin & Privacy',
		retention: scheduledRetentionRows(),
		jobs: safeDeferPromise(
			Promise.all([getLastJobRun('analytics-cleanup'), getLastJobRun('analytics-rollup')]).then(
				([cleanup, rollup]) => ({ cleanup, rollup }),
			),
			{ cleanup: null, rollup: null },
		),
	};
};
