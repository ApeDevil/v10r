import { fail } from '@sveltejs/kit';
import { hideComment, listForModeration, removeComment, unhideComment } from '$lib/server/blog/comments';
import { requireAdmin } from '$lib/server/http/guards';
import type { CommentStatus } from '$lib/types/db-enums';
import type { Actions, PageServerLoad } from './$types';

const STATUSES = new Set(['visible', 'hidden', 'removed', 'all']);

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);
	const statusParam = url.searchParams.get('status') ?? 'all';
	const status = (STATUSES.has(statusParam) ? statusParam : 'all') as CommentStatus | 'all';
	const postId = url.searchParams.get('postId') ?? undefined;
	const q = url.searchParams.get('q') ?? undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const result = await listForModeration({ status, postId, q, page, pageSize: 25 });
	return { ...result, filters: { status, postId: postId ?? '', q: q ?? '' } };
};

export const actions: Actions = {
	hide: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const reason = String(fd.get('reason') ?? '') || undefined;
		if (!id) return fail(400, { error: 'id required' });
		await hideComment({ commentId: id, actor: { id: user.id, email: user.email }, reason, ipAddress: locals.clientIp });
		return { hidden: true };
	},
	unhide: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { error: 'id required' });
		await unhideComment({ commentId: id, actor: { id: user.id, email: user.email }, ipAddress: locals.clientIp });
		return { restored: true };
	},
	remove: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const reason = String(fd.get('reason') ?? '') || undefined;
		if (!id) return fail(400, { error: 'id required' });
		await removeComment({
			commentId: id,
			actor: { id: user.id, email: user.email },
			reason,
			ipAddress: locals.clientIp,
		});
		return { removed: true };
	},
};
