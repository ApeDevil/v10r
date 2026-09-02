import { lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { retentionCutoff } from '$lib/server/retention';

export async function logCleanup(): Promise<number> {
	const cutoff = retentionCutoff('job-executions');

	const deleted = await db
		.delete(jobExecution)
		.where(lt(jobExecution.startedAt, cutoff))
		.returning({ id: jobExecution.id });

	return deleted.length;
}
