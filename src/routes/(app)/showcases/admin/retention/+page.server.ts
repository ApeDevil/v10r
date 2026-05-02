import { desc, eq } from 'drizzle-orm';
import {
	ANALYTICS_AGGREGATE_RETENTION_DAYS,
	ANALYTICS_RETENTION_DAYS,
	CONSENT_RETENTION_DAYS,
} from '$lib/server/config';
import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
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

	return rows[0] ?? null;
}

export const load: PageServerLoad = async () => {
	return {
		title: 'Retention — Admin & Privacy',
		retention: {
			events: ANALYTICS_RETENTION_DAYS,
			sessions: ANALYTICS_RETENTION_DAYS,
			aggregates: ANALYTICS_AGGREGATE_RETENTION_DAYS,
			consent: CONSENT_RETENTION_DAYS,
		},
		jobs: safeDeferPromise(
			Promise.all([getLastJobRun('analytics-cleanup'), getLastJobRun('analytics-rollup')]).then(
				([cleanup, rollup]) => ({ cleanup, rollup }),
			),
			{ cleanup: null, rollup: null },
		),
	};
};
