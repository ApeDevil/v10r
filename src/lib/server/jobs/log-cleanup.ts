import { db } from '$lib/server/db';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { lt } from 'drizzle-orm';

const RETENTION_DAYS = 90;

export async function logCleanup(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

	const deleted = await db
		.delete(jobExecution)
		.where(lt(jobExecution.startedAt, cutoff))
		.returning({ id: jobExecution.id });

	return deleted.length;
}
