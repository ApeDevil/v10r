import { createHash } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { account, session as sessionTable, user } from '$lib/server/db/schema/auth/_better-auth';
import type { Actions, PageServerLoad } from './$types';

function hashForDisplay(id: string): string {
	return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) redirect(303, '/auth/login');

	// Fetch sessions and linked accounts in parallel
	const [sessions, accounts] = await Promise.all([
		db
			.select({
				id: sessionTable.id,
				createdAt: sessionTable.createdAt,
				expiresAt: sessionTable.expiresAt,
				ipAddress: sessionTable.ipAddress,
				userAgent: sessionTable.userAgent,
			})
			.from(sessionTable)
			.where(eq(sessionTable.userId, locals.user.id)),
		db
			.select({
				providerId: account.providerId,
				createdAt: account.createdAt,
			})
			.from(account)
			.where(eq(account.userId, locals.user.id)),
	]);

	return {
		user: locals.user,
		sessions: sessions.map((s) => ({
			id: s.id,
			displayId: hashForDisplay(s.id),
			createdAt: s.createdAt.toISOString(),
			expiresAt: s.expiresAt.toISOString(),
			ipAddress: s.ipAddress,
			userAgent: s.userAgent,
			isCurrent: s.id === locals.session?.id,
		})),
		accounts: accounts.map((a) => ({
			provider: a.providerId,
			linkedAt: a.createdAt.toISOString(),
		})),
	};
};

export const actions: Actions = {
	revokeSession: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;

		if (!sessionId) return fail(400, { error: 'Missing session ID' });

		// Only allow revoking own sessions (not the current one)
		await db
			.delete(sessionTable)
			.where(
				and(
					eq(sessionTable.id, sessionId),
					eq(sessionTable.userId, locals.user.id),
					ne(sessionTable.id, locals.session?.id ?? ''),
				),
			);

		return { success: true };
	},

	exportData: async ({ locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const userData = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				image: user.image,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(eq(user.id, locals.user.id));

		const accountData = await db
			.select({
				providerId: account.providerId,
				createdAt: account.createdAt,
			})
			.from(account)
			.where(eq(account.userId, locals.user.id));

		const sessionData = await db
			.select({
				id: sessionTable.id,
				createdAt: sessionTable.createdAt,
				expiresAt: sessionTable.expiresAt,
				ipAddress: sessionTable.ipAddress,
				userAgent: sessionTable.userAgent,
			})
			.from(sessionTable)
			.where(eq(sessionTable.userId, locals.user.id));

		return {
			export: JSON.stringify(
				{
					user: userData[0],
					accounts: accountData.map((a) => ({
						provider: a.providerId,
						createdAt: a.createdAt,
					})),
					sessions: sessionData,
					exportedAt: new Date().toISOString(),
				},
				null,
				2,
			),
		};
	},

	deleteAccount: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const confirmation = formData.get('confirmation');

		if (confirmation !== 'DELETE') {
			return fail(400, { error: 'Type DELETE to confirm account deletion' });
		}

		// Delete user — cascades to sessions and accounts via FK
		await db.delete(user).where(eq(user.id, locals.user.id));

		redirect(303, '/');
	},
};
