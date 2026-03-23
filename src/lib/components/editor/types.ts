export interface EditorDocument {
	id: string;
	type: 'blog-post';
	postId: string;
	slug: string;
	status: 'draft' | 'published' | 'archived';
	title: string;
	summary: string;
	markdown: string;
	tags: { id: string; slug: string; name: string }[];
	locale: string;
	lastSavedAt: Date | null;
	revisionId: string | null;
}

export type SaveState = 'saved' | 'unsaved' | 'saving';
