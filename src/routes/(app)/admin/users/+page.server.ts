import { fail } from '@sveltejs/kit';
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { auth } from '$lib/server/auth';
import { requireAdmin } from '$lib/server/auth/guards';
import { ADMIN_USERS_PAGE_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
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
				role: user.role,
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

		try {
			await auth.api.banUser({ body: { userId, banReason: banReason || undefined }, headers: event.request.headers });

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
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to ban user.' });
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
			await auth.api.unbanUser({ body: { userId }, headers: event.request.headers });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'user.unban',
				targetType: 'user',
				targetId: userId,
			});

			return { success: true, message: 'User unbanned.' };
		} catch (e) {
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to unban user.' });
		}
	},

	setRole: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const userId = formData.get('userId');
		const role = formData.get('role');

		if (typeof userId !== 'string' || !userId) {
			return fail(400, { message: 'User ID required' });
		}
		if (typeof role !== 'string' || !['user', 'admin'].includes(role)) {
			return fail(400, { message: 'Invalid role' });
		}

		try {
			await auth.api.setRole({ body: { userId, role: role as 'user' | 'admin' }, headers: event.request.headers });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'user.set_role',
				targetType: 'user',
				targetId: userId,
				detail: { role },
			});

			return { success: true, message: `Role set to ${role}.` };
		} catch (e) {
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to set role.' });
		}
	},
};
