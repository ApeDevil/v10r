import { lt } from 'drizzle-orm';
import { LOG_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';

export async function logCleanup(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - LOG_RETENTION_DAYS);

	const deleted = await db
		.delete(jobExecution)
		.where(lt(jobExecution.startedAt, cutoff))
		.returning({ id: jobExecution.id });

	return deleted.length;
}
