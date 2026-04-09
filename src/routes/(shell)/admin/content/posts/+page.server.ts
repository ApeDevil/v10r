import { error, fail } from '@sveltejs/kit';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import {
	getLatestRevision,
	listPosts,
	publishRevision,
	softDeletePost,
	unpublishPost,
	updatePostMetadata,
} from '$lib/server/blog';
import { ADMIN_BLOG_PAGE_SIZE } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';

const SORTABLE_COLUMNS = ['title', 'status', 'created', 'updated', 'published'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

function isSortColumn(v: string): v is SortColumn {
	return (SORTABLE_COLUMNS as readonly string[]).includes(v);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const q = url.searchParams.get('q') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const sortParam = url.searchParams.get('sort') ?? 'created';
	const sort: SortColumn = isSortColumn(sortParam) ? sortParam : 'created';
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const statusFilter = url.searchParams.get('status') ?? 'all';

	const status =
		statusFilter === 'draft' || statusFilter === 'published' || statusFilter === 'archived' ? statusFilter : undefined;

	const { items, total } = await listPosts({
		status,
		search: q || undefined,
		page,
		pageSize: ADMIN_BLOG_PAGE_SIZE,
		sort,
		dir,
	});

	return {
		posts: items.map((p) => ({
			...p,
			createdAt: p.createdAt.toISOString(),
			updatedAt: p.updatedAt.toISOString(),
			publishedAt: p.publishedAt?.toISOString() ?? null,
		})),
		page,
		totalPages: Math.max(1, Math.ceil(total / ADMIN_BLOG_PAGE_SIZE)),
		q,
		sort,
		dir,
		statusFilter,
	};
};

function getPostId(formData: FormData): string {
	const postId = formData.get('postId');
	if (typeof postId !== 'string' || !postId) error(400, 'Post ID required');
	return postId;
}

export const actions: Actions = {
	publish: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const postId = getPostId(formData);

		try {
			const rev = await getLatestRevision(postId, 'en');
			if (!rev) return fail(400, { message: 'Post has no revisions to publish.' });

			await publishRevision(postId, 'en', rev.id);

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.post.publish',
				targetType: 'post',
				targetId: postId,
				detail: { revisionId: rev.id },
			});

			return { success: true, message: 'Post published.' };
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e) throw e;
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to publish.' });
		}
	},

	unpublish: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const postId = getPostId(formData);

		try {
			await unpublishPost(postId);

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.post.unpublish',
				targetType: 'post',
				targetId: postId,
			});

			return { success: true, message: 'Post unpublished.' };
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e) throw e;
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to unpublish.' });
		}
	},

	archive: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const postId = getPostId(formData);

		try {
			await updatePostMetadata(postId, { status: 'archived' });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.post.archive',
				targetType: 'post',
				targetId: postId,
			});

			return { success: true, message: 'Post archived.' };
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e) throw e;
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to archive.' });
		}
	},

	delete: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const postId = getPostId(formData);

		try {
			await softDeletePost(postId);

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.post.delete',
				targetType: 'post',
				targetId: postId,
			});

			return { success: true, message: 'Post deleted.' };
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e) throw e;
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to delete.' });
		}
	},
};
