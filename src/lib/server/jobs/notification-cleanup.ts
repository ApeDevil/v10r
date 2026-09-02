import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { retentionCutoff } from '$lib/server/retention';

export async function notificationCleanup(): Promise<number> {
	const now = new Date();
	const deleteCutoff = retentionCutoff('notifications-delete', now);

	const deleted = await db
		.delete(notifications)
		.where(and(isNotNull(notifications.archivedAt), lt(notifications.archivedAt, deleteCutoff)))
		.returning({ id: notifications.id });

	const archiveCutoff = retentionCutoff('notifications-archive', now);

	const archived = await db
		.update(notifications)
		.set({ archivedAt: now })
		.where(
			and(
				eq(notifications.isRead, true),
				lt(notifications.createdAt, archiveCutoff),
				sql`${notifications.archivedAt} IS NULL`,
			),
		)
		.returning({ id: notifications.id });

	return deleted.length + archived.length;
}
