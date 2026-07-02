import { lt } from 'drizzle-orm';
import { AUDIT_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { adminAuditLog } from '$lib/server/db/schema/admin';

/**
 * Delete `admin.audit_log` rows older than AUDIT_RETENTION_DAYS. The audit log is an
 * append-only, never-modified growth table, so it needs an explicit bound. The window is
 * deliberately long (a year) and configurable — audit trails are compliance-ish, so this
 * errs toward retention.
 *
 * Returns the number of rows deleted.
 */
export async function auditLogRetention(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);

	const deleted = await db
		.delete(adminAuditLog)
		.where(lt(adminAuditLog.occurredAt, cutoff))
		.returning({ id: adminAuditLog.id });

	return deleted.length;
}
