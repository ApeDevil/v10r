import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { localizeHref } from '$lib/i18n';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema/auth/_better-auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login'));

	// Fetch linked accounts for display
	const accounts = await db
		.select({
			providerId: account.providerId,
			createdAt: account.createdAt,
		})
		.from(account)
		.where(eq(account.userId, locals.user.id));

	return {
		title: 'Dashboard',
		user: locals.user,
		accounts: accounts.map((a) => ({
			provider: a.providerId,
			linkedAt: a.createdAt.toISOString(),
		})),
	};
};
