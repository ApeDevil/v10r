import { lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { adminAuditLog } from '$lib/server/db/schema/admin';
import { retentionCutoff } from '$lib/server/retention';

/**
 * Delete `admin.audit_log` rows past the `admin-audit-log` retention window. The audit log
 * is an append-only, never-modified growth table, so it needs an explicit bound. The window
 * is deliberately long — audit trails are compliance-ish, so this errs toward retention.
 *
 * Returns the number of rows deleted.
 */
export async function auditLogRetention(): Promise<number> {
	const cutoff = retentionCutoff('admin-audit-log');

	const deleted = await db
		.delete(adminAuditLog)
		.where(lt(adminAuditLog.occurredAt, cutoff))
		.returning({ id: adminAuditLog.id });

	return deleted.length;
}
