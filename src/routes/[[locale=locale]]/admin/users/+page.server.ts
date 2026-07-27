import { fail } from '@sveltejs/kit';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import { clearRevocation, stampRevocation } from '$lib/server/auth/revocation';
import { ADMIN_USERS_PAGE_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { session as sessionTable, user } from '$lib/server/db/schema/auth';
import type { Actions, PageServerLoad } from './$types';

const SORTABLE_COLUMNS = ['email', 'name', 'createdAt'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

function isSortColumn(v: string): v is SortColumn {
	return (SORTABLE_COLUMNS as readonly string[]).includes(v);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const q = url.searchParams.get('q') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const sortParam = url.searchParams.get('sort') ?? 'createdAt';
	const sort: SortColumn = isSortColumn(sortParam) ? sortParam : 'createdAt';
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const statusFilter = url.searchParams.get('status') ?? 'all';
	const offset = (page - 1) * ADMIN_USERS_PAGE_SIZE;

	const conditions = [];

	if (q) {
		conditions.push(or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)));
	}

	if (statusFilter === 'active') {
		conditions.push(or(eq(user.banned, false), sql`${user.banned} IS NULL`));
	} else if (statusFilter === 'banned') {
		conditions.push(eq(user.banned, true));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const orderBy = dir === 'asc' ? asc(user[sort]) : desc(user[sort]);

	const [users, totalResult] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				image: user.image,
				banned: user.banned,
				banReason: user.banReason,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(where)
			.orderBy(orderBy)
			.limit(ADMIN_USERS_PAGE_SIZE)
			.offset(offset),
		db.select({ total: count() }).from(user).where(where),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		title: 'Users',
		users: users.map((u) => ({
			...u,
			createdAt: u.createdAt.toISOString(),
		})),
		page,
		totalPages: Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE)),
		q,
		sort,
		dir,
		statusFilter,
	};
};

export const actions: Actions = {
	ban: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const userId = formData.get('userId');
		const banReason = formData.get('banReason') as string | null;

		if (typeof userId !== 'string' || !userId) {
			return fail(400, { message: 'User ID required' });
		}

		if (userId === event.locals.user?.id) {
			return fail(400, { message: 'You cannot ban your own account.' });
		}

		try {
			// Direct write, not auth.api.banUser: the admin() plugin that provided
			// that endpoint is deliberately not enabled (see auth/index.ts).
			await db
				.update(user)
				.set({ banned: true, bannedAt: new Date(), banReason: banReason || null })
				.where(eq(user.id, userId));

			// Drop live sessions, then stamp the revocation epoch — the row delete
			// alone would not bite for up to SESSION_COOKIE_MAX_AGE, so a banned
			// user would keep browsing for 5 minutes. No token is spared here.
			await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
			await stampRevocation(userId);

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'user.ban',
				targetType: 'user',
				targetId: userId,
				detail: { banReason: banReason || null },
			});

			return { success: true, message: 'User banned.' };
		} catch (e) {
			console.error('[admin:users] ban failed:', e);
			return fail(500, { message: 'Failed to ban user.' });
		}
	},

	unban: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const userId = formData.get('userId');

		if (typeof userId !== 'string' || !userId) {
			return fail(400, { message: 'User ID required' });
		}

		try {
			await db.update(user).set({ banned: false, bannedAt: null, banReason: null }).where(eq(user.id, userId));

			// Clear the epoch so the user can mint a fresh session immediately.
			await clearRevocation(userId);

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'user.unban',
				targetType: 'user',
				targetId: userId,
			});

			return { success: true, message: 'User unbanned.' };
		} catch (e) {
			console.error('[admin:users] unban failed:', e);
			return fail(500, { message: 'Failed to unban user.' });
		}
	},
};
