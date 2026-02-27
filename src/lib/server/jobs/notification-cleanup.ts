import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { and, lt, eq, isNotNull, sql } from 'drizzle-orm';
import { NOTIFICATION_ARCHIVE_DAYS, NOTIFICATION_DELETE_DAYS } from '$lib/server/config';

export async function notificationCleanup(): Promise<number> {
	const now = new Date();

	// Hard-delete archived notifications older than NOTIFICATION_DELETE_DAYS
	const deleteCutoff = new Date(now);
	deleteCutoff.setDate(deleteCutoff.getDate() - NOTIFICATION_DELETE_DAYS);

	const deleted = await db
		.delete(notifications)
		.where(
			and(isNotNull(notifications.archivedAt), lt(notifications.archivedAt, deleteCutoff)),
		)
		.returning({ id: notifications.id });

	// Archive read notifications older than NOTIFICATION_ARCHIVE_DAYS
	const archiveCutoff = new Date(now);
	archiveCutoff.setDate(archiveCutoff.getDate() - NOTIFICATION_ARCHIVE_DAYS);

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
