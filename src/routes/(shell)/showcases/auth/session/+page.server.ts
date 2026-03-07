import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = locals.session;
	const user = locals.user;

	return {
		authenticated: !!session,
		session: session
			? {
					id: session.id,
					createdAt: session.createdAt?.toISOString?.() ?? String(session.createdAt),
					expiresAt: session.expiresAt?.toISOString?.() ?? String(session.expiresAt),
					updatedAt: session.updatedAt?.toISOString?.() ?? String(session.updatedAt),
					ipAddress: session.ipAddress ?? null,
					userAgent: session.userAgent ?? null,
				}
			: null,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
				}
			: null,
		cookieCache: {
			enabled: true,
			maxAge: 300,
			description: 'Revalidates session from DB every 5 minutes',
		},
		lifecycle: {
			expiresIn: '7 days',
			updateAge: '24 hours',
			description:
				'Sessions auto-renew when active within 24h of last refresh. Expire after 7 days of complete inactivity.',
		},
	};
};
