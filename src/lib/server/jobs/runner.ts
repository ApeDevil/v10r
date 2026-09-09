import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { deferAfterResponse } from '$lib/server/http/after-response';
import { jobs } from './index';

export type TriggerType = 'cron' | 'scheduler' | 'manual';

export interface JobResult {
	slug: string;
	status: 'success' | 'failure';
	durationMs: number;
	resultCount: number | null;
	errorMessage: string | null;
}

export async function runJob(slug: string, trigger: TriggerType): Promise<JobResult> {
	const job = jobs[slug];
	if (!job) {
		return { slug, status: 'failure', durationMs: 0, resultCount: null, errorMessage: `Unknown job: ${slug}` };
	}

	const startedAt = new Date();
	const t0 = performance.now();
	let status: 'success' | 'failure' = 'success';
	let resultCount: number | null = null;
	let errorMessage: string | null = null;

	try {
		resultCount = await job.execute();
	} catch (err) {
		status = 'failure';
		errorMessage = err instanceof Error ? err.message : String(err);
	}

	const durationMs = Math.round(performance.now() - t0);
	const finishedAt = new Date();

	// Deferred: monitoring failure never masks job outcome, and a FAILED run is
	// exactly the row most likely to be lost if the instance freezes at response
	// time. The survival and error rules live in `deferAfterResponse`.
	deferAfterResponse(`jobs:run-log:${slug}`, () =>
		db
			.insert(jobExecution)
			.values({ jobSlug: slug, status, trigger, startedAt, finishedAt, durationMs, resultCount, errorMessage }),
	);

	return { slug, status, durationMs, resultCount, errorMessage };
}
