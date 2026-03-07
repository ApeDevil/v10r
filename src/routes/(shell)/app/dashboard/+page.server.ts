import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema/auth/_better-auth';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	// Auth guard handled by /app layout

	// Fetch linked accounts for display
	const accounts = await db
		.select({
			providerId: account.providerId,
			createdAt: account.createdAt,
		})
		.from(account)
		.where(eq(account.userId, locals.user.id));

	return {
		user: locals.user,
		accounts: accounts.map((a) => ({
			provider: a.providerId,
			linkedAt: a.createdAt.toISOString(),
		})),
	};
};
