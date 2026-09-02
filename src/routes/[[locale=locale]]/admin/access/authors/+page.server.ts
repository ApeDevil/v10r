import { fail } from '@sveltejs/kit';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { grantCapability, listGrantedUsers, revokeCapability } from '$lib/server/auth/grants';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { post } from '$lib/server/db/schema/blog/post';
import { requireAdmin } from '$lib/server/http/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const q = url.searchParams.get('q')?.trim();
	const grants = await listGrantedUsers('blog-author');

	const authorIds = grants.map((g) => g.userId);
	const userRows = authorIds.length
		? await db
				.select({ id: user.id, email: user.email, name: user.name })
				.from(user)
				.where(or(...authorIds.map((id) => eq(user.id, id))))
		: [];

	const userMap = new Map(userRows.map((u) => [u.id, u]));

	const authors = grants
		.map((g) => {
			const u = userMap.get(g.userId);
			return u ? { ...g, email: u.email, name: u.name } : null;
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);

	let searchResults: { id: string; email: string; name: string }[] = [];
	if (q && q.length >= 2) {
		searchResults = await db
			.select({ id: user.id, email: user.email, name: user.name })
			.from(user)
			.where(or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)))
			.limit(20);
	}

	return { authors, searchResults, query: q ?? '' };
};

export const actions: Actions = {
	grant: async ({ request, locals }) => {
		const { user: admin } = requireAdmin(locals);
		const fd = await request.formData();
		const userId = String(fd.get('userId') ?? '');
		if (!userId) return fail(400, { error: 'userId required' });

		await grantCapability({
			userId,
			kind: 'blog-author',
			actor: { id: admin.id, email: admin.email },
			ipAddress: locals.clientIp,
		});
		return { granted: true };
	},
	revoke: async ({ request, locals }) => {
		const { user: admin } = requireAdmin(locals);
		const fd = await request.formData();
		const userId = String(fd.get('userId') ?? '');
		const confirmed = fd.get('confirmed') === 'true';
		if (!userId) return fail(400, { error: 'userId required' });

		// Count drafts owned by this user
		const drafts = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(post)
			.where(and(eq(post.authorId, userId), eq(post.status, 'draft')));
		const draftCount = drafts[0]?.count ?? 0;

		if (draftCount > 0 && !confirmed) {
			return fail(409, { requiresConfirm: true, draftCount, userId });
		}

		await revokeCapability({
			userId,
			kind: 'blog-author',
			actor: { id: admin.id, email: admin.email },
			ipAddress: locals.clientIp,
		});
		return { revoked: true, draftCount };
	},
};
