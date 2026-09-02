import type { PostStatus } from '$lib/types/db-enums';
export interface EditorDocument {
	id: string;
	type: 'blog-post';
	postId: string;
	slug: string;
	status: PostStatus;
	title: string;
	summary: string;
	markdown: string;
	tags: { id: string; slug: string; name: string; icon: string | null; color: number | null; glyph: string | null }[];
	locale: string;
	lastSavedAt: Date | null;
	revisionId: string | null;
}

export type SaveState = 'saved' | 'unsaved' | 'saving';
