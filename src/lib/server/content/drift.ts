/**
 * Drift detection: compare a content file's hash against what's currently
 * published in the DB for the same `(slug, locale)`. Used by the preview
 * route's drift banner and by `bun run content:check`.
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { Locale } from '$lib/i18n/runtime';
import { post, publishedRevision, revision } from '$lib/server/db/schema/blog';
import type { Database } from '$lib/server/db/types';
import type { DriftStatus } from './types';

/**
 * Returns the drift state for a given file's hash against the currently published
 * revision for that slug+locale. The slug is the lookup key (mutable but unique
 * among non-soft-deleted posts).
 */
export async function getPreviewDrift(
	db: Database,
	slug: string,
	locale: Locale,
	fileHash: string,
): Promise<DriftStatus> {
	const [row] = await db
		.select({
			dbHash: revision.contentHash,
			createdAt: revision.createdAt,
		})
		.from(post)
		.innerJoin(publishedRevision, eq(publishedRevision.postId, post.id))
		.innerJoin(revision, eq(publishedRevision.revisionId, revision.id))
		.where(and(eq(post.slug, slug), eq(publishedRevision.locale, locale), isNull(post.deletedAt)))
		.limit(1);

	if (!row) return { status: 'not-pushed' };
	if (row.dbHash === fileHash) return { status: 'up-to-date', lastPublishedAt: row.createdAt };
	return { status: 'ahead', lastPublishedAt: row.createdAt, dbHash: row.dbHash };
}
