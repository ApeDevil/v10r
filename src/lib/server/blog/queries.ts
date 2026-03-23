import { and, count, desc, asc, eq, isNull, sql, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { post, revision, publishedRevision, tag, postTag } from '$lib/server/db/schema/blog';
import { user } from '$lib/server/db/schema/auth';
import type { BlogTag, ListPostsOptions, PostListItem, PublishedPost, TagWithCount } from './types';

const DEFAULT_PAGE_SIZE = 20;

/** List posts with filtering, pagination, and joined metadata. */
export async function listPosts(options: ListPostsOptions = {}): Promise<{
	items: PostListItem[];
	total: number;
}> {
	const {
		status,
		authorId,
		tagSlug,
		search,
		page = 1,
		pageSize = DEFAULT_PAGE_SIZE,
		sort = 'created',
		dir = 'desc',
	} = options;

	const conditions = [isNull(post.deletedAt)];
	if (status) conditions.push(eq(post.status, status));
	if (authorId) conditions.push(eq(post.authorId, authorId));

	// If filtering by tag, find matching post IDs first
	let tagFilterPostIds: string[] | undefined;
	if (tagSlug) {
		const tagRow = await db
			.select({ id: tag.id })
			.from(tag)
			.where(eq(tag.slug, tagSlug))
			.limit(1);
		if (tagRow.length === 0) return { items: [], total: 0 };

		const taggedPosts = await db
			.select({ postId: postTag.postId })
			.from(postTag)
			.where(eq(postTag.tagId, tagRow[0].id));
		tagFilterPostIds = taggedPosts.map((r) => r.postId);
		if (tagFilterPostIds.length === 0) return { items: [], total: 0 };
		conditions.push(inArray(post.id, tagFilterPostIds));
	}

	const where = and(...conditions);

	// Get total count
	const [countResult] = await db.select({ total: count() }).from(post).where(where);
	const total = countResult?.total ?? 0;

	// Sort
	const sortColumn = {
		created: post.createdAt,
		updated: post.updatedAt,
		published: post.publishedAt,
		title: post.slug, // sort by slug as proxy; title is on revision
	}[sort];
	const orderFn = dir === 'asc' ? asc : desc;

	// Fetch posts
	const offset = (page - 1) * pageSize;
	const posts = await db
		.select({
			id: post.id,
			slug: post.slug,
			status: post.status,
			authorId: post.authorId,
			authorName: user.name,
			publishedAt: post.publishedAt,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
		})
		.from(post)
		.leftJoin(user, eq(post.authorId, user.id))
		.where(where)
		.orderBy(orderFn(sortColumn))
		.limit(pageSize)
		.offset(offset);

	if (posts.length === 0) return { items: [], total };

	// Fetch latest revision title/summary for each post
	const postIds = posts.map((p) => p.id);
	const latestRevisions = await db
		.select({
			postId: revision.postId,
			title: revision.title,
			summary: revision.summary,
		})
		.from(revision)
		.where(inArray(revision.postId, postIds))
		.orderBy(desc(revision.createdAt));

	// Deduplicate to get only the latest per post
	const revisionMap = new Map<string, { title: string; summary: string | null }>();
	for (const r of latestRevisions) {
		if (!revisionMap.has(r.postId)) {
			revisionMap.set(r.postId, { title: r.title, summary: r.summary });
		}
	}

	// Fetch tags for each post
	const postTagRows = await db
		.select({
			postId: postTag.postId,
			tagId: tag.id,
			tagSlug: tag.slug,
			tagName: tag.name,
		})
		.from(postTag)
		.innerJoin(tag, eq(postTag.tagId, tag.id))
		.where(inArray(postTag.postId, postIds));

	const tagMap = new Map<string, { id: string; slug: string; name: string }[]>();
	for (const row of postTagRows) {
		const tags = tagMap.get(row.postId) ?? [];
		tags.push({ id: row.tagId, slug: row.tagSlug, name: row.tagName });
		tagMap.set(row.postId, tags);
	}

	// Search filter (post-query for now; can optimize with search_vector later)
	let items: PostListItem[] = posts.map((p) => {
		const rev = revisionMap.get(p.id);
		return {
			...p,
			title: rev?.title ?? '(untitled)',
			summary: rev?.summary ?? null,
			tags: tagMap.get(p.id) ?? [],
		};
	});

	if (search) {
		const q = search.toLowerCase();
		items = items.filter(
			(item) =>
				item.title.toLowerCase().includes(q) ||
				item.slug.includes(q) ||
				item.summary?.toLowerCase().includes(q),
		);
	}

	return { items, total };
}

/** Get a post by slug with its published revision for a locale. */
export async function getPublishedPostForSlug(
	slug: string,
	locale = 'en',
): Promise<PublishedPost | null> {
	const [row] = await db
		.select({
			postId: post.id,
			slug: post.slug,
			publishedAt: post.publishedAt,
			authorId: user.id,
			authorName: user.name,
			authorImage: user.image,
			revisionTitle: revision.title,
			revisionSummary: revision.summary,
			revisionHtml: revision.renderedHtml,
			revisionEmbeds: revision.embedDescriptors,
			revisionLocale: revision.locale,
			revisionCreatedAt: revision.createdAt,
		})
		.from(post)
		.innerJoin(publishedRevision, eq(post.id, publishedRevision.postId))
		.innerJoin(revision, eq(publishedRevision.revisionId, revision.id))
		.leftJoin(user, eq(post.authorId, user.id))
		.where(
			and(
				eq(post.slug, slug),
				eq(publishedRevision.locale, locale),
				eq(post.status, 'published'),
				isNull(post.deletedAt),
			),
		)
		.limit(1);

	if (!row) return null;

	// Fetch tags
	const tags = await db
		.select({ id: tag.id, slug: tag.slug, name: tag.name })
		.from(tag)
		.innerJoin(postTag, eq(tag.id, postTag.tagId))
		.where(eq(postTag.postId, row.postId));

	return {
		id: row.postId,
		slug: row.slug,
		publishedAt: row.publishedAt!,
		author: {
			id: row.authorId!,
			name: row.authorName ?? 'Unknown',
			image: row.authorImage,
		},
		revision: {
			title: row.revisionTitle,
			summary: row.revisionSummary,
			renderedHtml: row.revisionHtml ?? '',
			embedDescriptors: row.revisionEmbeds,
			locale: row.revisionLocale,
			createdAt: row.revisionCreatedAt,
		},
		tags,
	};
}

/** Get a post by ID (for editing). */
export async function getPostById(id: string) {
	const [row] = await db
		.select()
		.from(post)
		.where(and(eq(post.id, id), isNull(post.deletedAt)))
		.limit(1);
	return row ?? null;
}

/** Get a post by slug (for editing). */
export async function getPostBySlug(slug: string) {
	const [row] = await db
		.select()
		.from(post)
		.where(and(eq(post.slug, slug), isNull(post.deletedAt)))
		.limit(1);
	return row ?? null;
}

/** List revisions for a post, newest first. */
export async function getRevisions(postId: string, locale?: string) {
	const conditions = [eq(revision.postId, postId)];
	if (locale) conditions.push(eq(revision.locale, locale));

	return db
		.select({
			id: revision.id,
			revisionNumber: revision.revisionNumber,
			title: revision.title,
			locale: revision.locale,
			authorId: revision.authorId,
			createdAt: revision.createdAt,
		})
		.from(revision)
		.where(and(...conditions))
		.orderBy(desc(revision.createdAt));
}

/** Get the latest revision for a post/locale. */
export async function getLatestRevision(postId: string, locale = 'en') {
	const [row] = await db
		.select()
		.from(revision)
		.where(and(eq(revision.postId, postId), eq(revision.locale, locale)))
		.orderBy(desc(revision.createdAt))
		.limit(1);
	return row ?? null;
}

/** List all tags ordered by name. */
export async function listTags(): Promise<TagWithCount[]> {
	const rows = await db
		.select({
			id: tag.id,
			slug: tag.slug,
			name: tag.name,
			postCount: count(postTag.postId),
		})
		.from(tag)
		.leftJoin(postTag, eq(tag.id, postTag.tagId))
		.groupBy(tag.id, tag.slug, tag.name)
		.orderBy(asc(tag.name));

	return rows;
}

/** Full-text search on revisions using tsvector. */
export async function searchPosts(query: string, limit = 20) {
	return db
		.select({
			postId: revision.postId,
			title: revision.title,
			summary: revision.summary,
			rank: sql<number>`ts_rank(search_vector, plainto_tsquery('english', ${query}))`,
		})
		.from(revision)
		.where(sql`search_vector @@ plainto_tsquery('english', ${query})`)
		.orderBy(desc(sql`ts_rank(search_vector, plainto_tsquery('english', ${query}))`))
		.limit(limit);
}

/** Get a single tag by slug. */
export async function getTagBySlug(slug: string): Promise<BlogTag | null> {
	const [row] = await db
		.select()
		.from(tag)
		.where(eq(tag.slug, slug))
		.limit(1);
	return row ?? null;
}

/** Published posts for RSS feed (lightweight, no pagination). */
export async function listPublishedPostsForFeed(limit = 20): Promise<
	{
		slug: string;
		title: string;
		summary: string | null;
		publishedAt: Date;
		authorName: string | null;
	}[]
> {
	const posts = await db
		.select({
			slug: post.slug,
			publishedAt: post.publishedAt,
			authorName: user.name,
		})
		.from(post)
		.leftJoin(user, eq(post.authorId, user.id))
		.where(
			and(
				eq(post.status, 'published'),
				isNull(post.deletedAt),
			),
		)
		.orderBy(desc(post.publishedAt))
		.limit(limit);

	if (posts.length === 0) return [];

	const postSlugs = posts.map((p) => p.slug);

	// Get latest revision title/summary for each post via slug -> post_id lookup
	const postRows = await db
		.select({ id: post.id, slug: post.slug })
		.from(post)
		.where(inArray(post.slug, postSlugs));

	const slugToId = new Map(postRows.map((p) => [p.slug, p.id]));
	const postIds = [...slugToId.values()];

	const latestRevisions = await db
		.select({
			postId: revision.postId,
			title: revision.title,
			summary: revision.summary,
		})
		.from(revision)
		.where(inArray(revision.postId, postIds))
		.orderBy(desc(revision.createdAt));

	const revisionMap = new Map<string, { title: string; summary: string | null }>();
	for (const r of latestRevisions) {
		if (!revisionMap.has(r.postId)) {
			revisionMap.set(r.postId, { title: r.title, summary: r.summary });
		}
	}

	return posts.map((p) => {
		const postId = slugToId.get(p.slug);
		const rev = postId ? revisionMap.get(postId) : undefined;
		return {
			slug: p.slug,
			title: rev?.title ?? '(untitled)',
			summary: rev?.summary ?? null,
			publishedAt: p.publishedAt!,
			authorName: p.authorName,
		};
	});
}

/** Get tags for a specific post. */
export async function getTagsForPost(postId: string) {
	return db
		.select({ id: tag.id, slug: tag.slug, name: tag.name })
		.from(tag)
		.innerJoin(postTag, eq(tag.id, postTag.tagId))
		.where(eq(postTag.postId, postId));
}

/** Check if a slug is already taken. */
export async function isSlugTaken(slug: string, excludePostId?: string): Promise<boolean> {
	const conditions = [eq(post.slug, slug), isNull(post.deletedAt)];
	if (excludePostId) conditions.push(sql`${post.id} != ${excludePostId}`);

	const [row] = await db
		.select({ id: post.id })
		.from(post)
		.where(and(...conditions))
		.limit(1);
	return !!row;
}
