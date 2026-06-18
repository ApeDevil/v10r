import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { localizeHref } from '$lib/i18n';
import { passkeysEnabled } from '$lib/server/auth';
import { publicUser } from '$lib/server/auth/public-user';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema/auth/_better-auth';
import { countPasskeys } from '$lib/server/db/user';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login'));

	// Fetch linked accounts for display + passkey count for the enrollment nudge
	const [accounts, passkeyCount] = await Promise.all([
		db
			.select({
				providerId: account.providerId,
				createdAt: account.createdAt,
			})
			.from(account)
			.where(eq(account.userId, locals.user.id)),
		passkeysEnabled ? countPasskeys(locals.user.id) : Promise.resolve(0),
	]);

	return {
		title: 'Dashboard',
		user: publicUser(locals.user),
		showPasskeyNudge: passkeysEnabled && passkeyCount === 0,
		accounts: accounts.map((a) => ({
			provider: a.providerId,
			linkedAt: a.createdAt.toISOString(),
		})),
	};
};
