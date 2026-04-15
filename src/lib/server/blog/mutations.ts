import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { asset, domain, post, postAsset, postTag, publishedRevision, revision, tag } from '$lib/server/db/schema/blog';
import { contentHash } from './content-hash';
import { renderBlogPost } from './pipeline';
import type { BlogAsset, BlogDomain, BlogPost, BlogRevision, BlogTag } from './types';

// ── Posts ────────────────────────────────────────────────────────────

/** Create a new blog post (draft). */
export async function createPost(authorId: string, data: { slug: string }): Promise<BlogPost> {
	const [row] = await db
		.insert(post)
		.values({
			id: createId.post(),
			slug: data.slug,
			authorId,
		})
		.returning();
	return row;
}

/** Update post metadata (not content — content lives in revisions). */
export async function updatePostMetadata(
	postId: string,
	data: {
		slug?: string;
		status?: 'draft' | 'published' | 'archived';
		coverImageId?: string | null;
		publishedAt?: Date | null;
		folderId?: string | null;
	},
): Promise<BlogPost | null> {
	const [row] = await db
		.update(post)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(post.id, postId), isNull(post.deletedAt)))
		.returning();
	return row ?? null;
}

/** Soft-delete a post. */
export async function softDeletePost(postId: string): Promise<boolean> {
	const [row] = await db
		.update(post)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(post.id, postId), isNull(post.deletedAt)))
		.returning({ id: post.id });
	return !!row;
}

// ── Revisions ────────────────────────────────────────────────────────

/** Create an immutable revision. Auto-renders markdown and computes content hash. */
export async function createRevision(
	postId: string,
	data: {
		title: string;
		summary?: string;
		markdown: string;
		locale?: string;
		authorId: string;
	},
): Promise<BlogRevision> {
	const locale = data.locale ?? 'en';

	// Render and hash in parallel
	let hash: string;
	let renderedHtml: string | null = null;
	let embedDescriptors: unknown = null;

	try {
		const [hashResult, renderResult] = await Promise.all([contentHash(data.markdown), renderBlogPost(data.markdown)]);
		hash = hashResult;
		renderedHtml = renderResult.html;
		embedDescriptors = renderResult.embeds;
	} catch (error) {
		console.warn('[blog/mutations] Pipeline failed, saving revision without rendered HTML:', error);
		hash = await contentHash(data.markdown);
	}

	// Assign revision number within a transaction
	const [row] = await db.transaction(async (tx) => {
		const [maxResult] = await tx
			.select({
				maxNum: sql<number>`COALESCE(MAX(${revision.revisionNumber}), 0)`,
			})
			.from(revision)
			.where(and(eq(revision.postId, postId), eq(revision.locale, locale)));

		const nextNumber = (maxResult?.maxNum ?? 0) + 1;

		return tx
			.insert(revision)
			.values({
				id: createId.revision(),
				postId,
				revisionNumber: nextNumber,
				title: data.title,
				summary: data.summary ?? null,
				markdown: data.markdown,
				locale,
				renderedHtml,
				embedDescriptors,
				contentHash: hash,
				authorId: data.authorId,
			})
			.returning();
	});

	// Update post's updatedAt
	await db.update(post).set({ updatedAt: new Date() }).where(eq(post.id, postId));

	return row;
}

// ── Publishing ───────────────────────────────────────────────────────

/** Publish a specific revision for a locale. UPSERT on published_revision. */
export async function publishRevision(postId: string, locale: string, revisionId: string): Promise<void> {
	// Verify revision belongs to this post
	const [rev] = await db.select({ postId: revision.postId }).from(revision).where(eq(revision.id, revisionId)).limit(1);
	if (!rev || rev.postId !== postId) {
		throw new Error('Revision does not belong to post');
	}

	// Verify post has a domain assigned
	const [postRow] = await db.select({ domainId: post.domainId }).from(post).where(eq(post.id, postId)).limit(1);
	if (!postRow?.domainId) {
		throw new Error('Domain is required to publish a post');
	}

	await db.transaction(async (tx) => {
		// UPSERT published revision pointer
		await tx
			.insert(publishedRevision)
			.values({ postId, locale, revisionId })
			.onConflictDoUpdate({
				target: [publishedRevision.postId, publishedRevision.locale],
				set: { revisionId },
			});

		// Update post status + published_at
		await tx
			.update(post)
			.set({
				status: 'published',
				publishedAt: sql`COALESCE(${post.publishedAt}, now())`,
				updatedAt: new Date(),
			})
			.where(eq(post.id, postId));
	});
}

/** Unpublish a post: remove all published_revision rows, set status to archived. */
export async function unpublishPost(postId: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(publishedRevision).where(eq(publishedRevision.postId, postId));

		await tx.update(post).set({ status: 'archived', updatedAt: new Date() }).where(eq(post.id, postId));
	});
}

// ── Tags ─────────────────────────────────────────────────────────────

/** Create a new tag. */
export async function createTag(
	name: string,
	slug: string,
	opts?: { icon?: string | null; color?: number | null; glyph?: string | null },
): Promise<BlogTag> {
	const [row] = await db
		.insert(tag)
		.values({
			id: createId.tag(),
			slug,
			name,
			icon: opts?.icon ?? null,
			color: opts?.color ?? null,
			glyph: opts?.glyph ?? null,
		})
		.returning();
	return row;
}

/** Update a tag. */
export async function updateTag(
	tagId: string,
	data: { name?: string; slug?: string; icon?: string | null; color?: number | null; glyph?: string | null },
): Promise<BlogTag | null> {
	const [row] = await db.update(tag).set(data).where(eq(tag.id, tagId)).returning();
	return row ?? null;
}

/** Delete a tag (CASCADE removes post_tag associations). */
export async function deleteTag(tagId: string): Promise<boolean> {
	const [row] = await db.delete(tag).where(eq(tag.id, tagId)).returning({ id: tag.id });
	return !!row;
}

/** Set the tags for a post (delete-then-insert). */
export async function setPostTags(postId: string, tagIds: string[]): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(postTag).where(eq(postTag.postId, postId));
		if (tagIds.length > 0) {
			await tx.insert(postTag).values(tagIds.map((tagId) => ({ postId, tagId })));
		}
	});
}

// ── Domains ─────────────────────────────────────────────────────────

/** Create a new domain. */
export async function createDomain(
	name: string,
	slug: string,
	opts?: { icon?: string | null; color?: number | null; description?: string | null },
): Promise<BlogDomain> {
	const [row] = await db
		.insert(domain)
		.values({
			id: createId.domain(),
			slug,
			name,
			icon: opts?.icon ?? null,
			color: opts?.color ?? null,
			description: opts?.description ?? null,
		})
		.returning();
	return row;
}

/** Update a domain. */
export async function updateDomain(
	domainId: string,
	data: { name?: string; slug?: string; icon?: string | null; color?: number | null; description?: string | null },
): Promise<BlogDomain | null> {
	const [row] = await db.update(domain).set(data).where(eq(domain.id, domainId)).returning();
	return row ?? null;
}

/** Delete a domain (posts get domainId = null via onDelete: 'set null'). */
export async function deleteDomain(domainId: string): Promise<boolean> {
	const [row] = await db.delete(domain).where(eq(domain.id, domainId)).returning({ id: domain.id });
	return !!row;
}

/** Set the domain for a post. Pass null to unset. */
export async function setPostDomain(postId: string, domainId: string | null): Promise<void> {
	await db
		.update(post)
		.set({ domainId, updatedAt: new Date() })
		.where(and(eq(post.id, postId), isNull(post.deletedAt)));
}

// ── Assets ───────────────────────────────────────────────────────────

/** Register a new asset (after upload to R2). */
export async function createAsset(data: {
	uploaderId: string;
	fileName: string;
	mimeType: string;
	fileSize: number;
	storageKey: string;
	altText?: string;
	width?: number;
	height?: number;
}): Promise<BlogAsset> {
	const [row] = await db
		.insert(asset)
		.values({ id: createId.asset(), ...data })
		.returning();
	return row;
}

/** Link an asset to a post. */
export async function linkAssetToPost(postId: string, assetId: string): Promise<void> {
	await db.insert(postAsset).values({ postId, assetId }).onConflictDoNothing();
}

/** Unlink an asset from a post. */
export async function unlinkAssetFromPost(postId: string, assetId: string): Promise<void> {
	await db.delete(postAsset).where(and(eq(postAsset.postId, postId), eq(postAsset.assetId, assetId)));
}

/** Update asset metadata (alt text, dimensions, folder placement). */
export async function updateAssetMetadata(
	assetId: string,
	data: { altText?: string; width?: number; height?: number; fileName?: string; folderId?: string | null },
): Promise<BlogAsset | null> {
	const [row] = await db.update(asset).set(data).where(eq(asset.id, assetId)).returning();
	return row ?? null;
}

/** Delete an asset record. Fails with FK RESTRICT if still linked to posts. */
export async function deleteAsset(assetId: string): Promise<boolean> {
	const [row] = await db.delete(asset).where(eq(asset.id, assetId)).returning({ id: asset.id });
	return !!row;
}
