import { and, isNotNull, lt } from 'drizzle-orm';
import { DESK_REVISION_RETENTION_DAYS, DESK_SOFT_DELETE_RETENTION_DAYS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { file, fileRevision } from '$lib/server/db/schema/desk';

/**
 * Sweep soft-deleted desk content and prune stale revisions — the retention job the
 * `deleteFile` mutation's "stays until a retention sweep runs" comment referred to.
 *
 *   - `file`: hard-deleted DESK_SOFT_DELETE_RETENTION_DAYS after soft-delete. Its
 *     `spreadsheet` / `markdown` detail row is removed by FK `ON DELETE CASCADE`.
 *   - `file_revision`: the undo/version trail has no FK to `file`, so it's age-capped
 *     independently at DESK_REVISION_RETENTION_DAYS.
 *
 * Returns the total rows deleted (files + revisions).
 */
export async function deskRetention(): Promise<number> {
	const fileCutoff = new Date();
	fileCutoff.setDate(fileCutoff.getDate() - DESK_SOFT_DELETE_RETENTION_DAYS);

	const revisionCutoff = new Date();
	revisionCutoff.setDate(revisionCutoff.getDate() - DESK_REVISION_RETENTION_DAYS);

	const deletedFiles = await db
		.delete(file)
		.where(and(isNotNull(file.deletedAt), lt(file.deletedAt, fileCutoff)))
		.returning({ id: file.id });

	const deletedRevisions = await db
		.delete(fileRevision)
		.where(lt(fileRevision.createdAt, revisionCutoff))
		.returning({ id: fileRevision.id });

	return deletedFiles.length + deletedRevisions.length;
}
