import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { jobs } from '$lib/server/jobs';
import { runJob } from '$lib/server/jobs/runner';
import { desc, eq, count, max, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const jobFilter = url.searchParams.get('job') || 'all';
	const offset = (page - 1) * PAGE_SIZE;

	const registeredJobs = Object.keys(jobs);

	// Per-job aggregate stats
	const statsQuery = db
		.select({
			jobSlug: jobExecution.jobSlug,
			totalRuns: count(),
			lastRun: max(jobExecution.startedAt),
			lastStatus: sql<string>`(
				SELECT ${jobExecution.status} FROM jobs.job_execution je2
				WHERE je2.job_slug = ${jobExecution.jobSlug}
				ORDER BY je2.started_at DESC LIMIT 1
			)`,
			lastDuration: sql<number>`(
				SELECT ${jobExecution.durationMs} FROM jobs.job_execution je2
				WHERE je2.job_slug = ${jobExecution.jobSlug}
				ORDER BY je2.started_at DESC LIMIT 1
			)`,
			lastResultCount: sql<number | null>`(
				SELECT ${jobExecution.resultCount} FROM jobs.job_execution je2
				WHERE je2.job_slug = ${jobExecution.jobSlug}
				ORDER BY je2.started_at DESC LIMIT 1
			)`,
		})
		.from(jobExecution)
		.groupBy(jobExecution.jobSlug);

	// Paginated execution history
	const historyBase = jobFilter !== 'all'
		? db
				.select()
				.from(jobExecution)
				.where(eq(jobExecution.jobSlug, jobFilter))
		: db.select().from(jobExecution);

	const [stats, history, totalResult] = await Promise.all([
		statsQuery,
		historyBase.orderBy(desc(jobExecution.startedAt)).limit(PAGE_SIZE).offset(offset),
		jobFilter !== 'all'
			? db.select({ total: count() }).from(jobExecution).where(eq(jobExecution.jobSlug, jobFilter))
			: db.select({ total: count() }).from(jobExecution),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		registeredJobs,
		stats,
		history: history.map((h) => ({
			...h,
			startedAt: h.startedAt.toISOString(),
			finishedAt: h.finishedAt.toISOString(),
		})),
		page,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		jobFilter,
	};
};

export const actions: Actions = {
	trigger: async ({ request }) => {
		const formData = await request.formData();
		const slug = formData.get('slug');

		if (typeof slug !== 'string' || !jobs[slug]) {
			return fail(400, { message: `Unknown job: ${slug}` });
		}

		const result = await runJob(slug, 'manual');

		if (result.status === 'failure') {
			return fail(500, { message: result.errorMessage || 'Job failed.' });
		}

		return { success: true, message: `${slug}: ${result.status} (${result.durationMs}ms, ${result.resultCount ?? 0} affected)` };
	},
};
