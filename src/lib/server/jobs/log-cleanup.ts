import { lt } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { jobExecution } from '#lib/server/db/schema/jobs/index.ts';
import { retentionCutoff } from '#lib/server/retention/index.ts';

export async function logCleanup(): Promise<number> {
	const cutoff = retentionCutoff('job-executions');

	const deleted = await db
		.delete(jobExecution)
		.where(lt(jobExecution.startedAt, cutoff))
		.returning({ id: jobExecution.id });

	return deleted.length;
}
