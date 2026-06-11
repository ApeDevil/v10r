import { createHash } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { getUserAccounts, getUserSessions, revokeSession } from '$lib/server/db/user';
import { collectUserData, deleteUserData } from '$lib/server/privacy';
import type { Actions, PageServerLoad } from './$types';

function hashForDisplay(id: string): string {
	return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) redirect(303, localizeHref('/auth/login'));

	// Fetch sessions and linked accounts in parallel
	const [sessions, accounts] = await Promise.all([getUserSessions(locals.user.id), getUserAccounts(locals.user.id)]);

	return {
		title: 'Account',
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
			linkedAt: a.createdAt?.toISOString() ?? '',
		})),
	};
};

export const actions: Actions = {
	revokeSession: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;

		if (!sessionId) return fail(400, { error: 'Missing session ID' });

		// Only allow revoking own sessions (not the current one)
		await revokeSession(sessionId, locals.user.id, locals.session?.id ?? '');

		return { success: true };
	},

	exportData: async ({ locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		// One canonical definition of "all my data" — same aggregator as
		// /app/account/data and /api/me/data. Secrets and prior-session
		// raw IPs are projected/masked inside collectUserData.
		const report = await collectUserData(locals.user.id, { currentSessionId: locals.session?.id });

		return { export: JSON.stringify(report, null, 2) };
	},

	deleteAccount: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const confirmation = formData.get('confirmation');

		if (confirmation !== 'DELETE') {
			return fail(400, { error: 'Type DELETE to confirm account deletion' });
		}

		// Cascade erasure via the canonical privacy module (GDPR Art 17)
		await deleteUserData(locals.user.id);

		redirect(303, localizeHref('/'));
	},
};
