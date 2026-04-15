import type { InferSelectModel } from 'drizzle-orm';
import type { asset, domain, post, revision, tag } from '$lib/server/db/schema/blog';

export type BlogPost = InferSelectModel<typeof post>;
export type BlogRevision = InferSelectModel<typeof revision>;
export type BlogTag = InferSelectModel<typeof tag>;
export type BlogAsset = InferSelectModel<typeof asset>;
export type BlogDomain = InferSelectModel<typeof domain>;

export interface PostListItem {
	id: string;
	slug: string;
	status: 'draft' | 'published' | 'archived';
	authorId: string;
	authorName: string | null;
	folderId: string | null;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	/** From the latest revision */
	title: string;
	summary: string | null;
	/** Subject area (one per post, null for drafts) */
	domain: { id: string; slug: string; name: string; icon: string | null; color: number | null } | null;
	/** Content format categories (zero-to-many) */
	tags: { id: string; slug: string; name: string; icon: string | null; color: number | null; glyph: string | null }[];
}

export interface PostDetail extends BlogPost {
	author: { id: string; name: string; email: string; image: string | null } | null;
	latestRevision: BlogRevision | null;
	domain: BlogDomain | null;
	tags: BlogTag[];
}

export interface PublishedPost {
	id: string;
	slug: string;
	publishedAt: Date;
	author: { id: string; name: string; image: string | null };
	revision: {
		title: string;
		summary: string | null;
		renderedHtml: string;
		embedDescriptors: unknown;
		locale: string;
		createdAt: Date;
	};
	domain: { id: string; slug: string; name: string; icon: string | null; color: number | null } | null;
	tags: BlogTag[];
}

export interface TagWithCount extends BlogTag {
	postCount: number;
}

export interface DomainWithCount extends BlogDomain {
	postCount: number;
}

export interface EmbedDescriptor {
	id: string;
	kind: string;
	attrs: Record<string, string>;
	content?: string;
}

export interface TocEntry {
	depth: number;
	id: string;
	text: string;
}

export interface ListPostsOptions {
	status?: 'draft' | 'published' | 'archived';
	authorId?: string;
	domainSlug?: string;
	tagSlug?: string;
	search?: string;
	page?: number;
	pageSize?: number;
	sort?: 'created' | 'updated' | 'published' | 'title' | 'status';
	dir?: 'asc' | 'desc';
}
