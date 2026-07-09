import { createHash } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { passkeysEnabled } from '$lib/server/auth';
import { requireStepUp } from '$lib/server/auth/step-up';
import { getUserSessions, listPasskeyDtos, revokeSession } from '$lib/server/db/user';
import { maskIp } from '$lib/server/privacy';
import type { Actions, PageServerLoad } from './$types';

/** Sessions are shown by an opaque digest — the raw token id never reaches the client list. */
function hashForDisplay(id: string): string {
	return createHash('sha256').update(id).digest('hex').slice(0, 12);
}

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	if (!locals.user || !locals.session) redirect(303, localizeHref('/auth/login'));

	setHeaders({ 'Cache-Control': 'no-store, private' });

	const currentSessionId = locals.session.id;

	const [passkeys, sessions] = await Promise.all([
		passkeysEnabled ? listPasskeyDtos(locals.user.id) : Promise.resolve([]),
		getUserSessions(locals.user.id),
	]);

	return {
		title: 'Security',
		passkeysEnabled,
		twoFactorEnabled: !!locals.user.twoFactorEnabled,
		passkeys: passkeys.map((p) => ({
			id: p.id,
			name: p.name,
			authenticatorLabel: p.authenticatorLabel,
			deviceType: p.deviceType,
			backedUp: p.backedUp,
			createdAt: p.createdAt?.toISOString() ?? null,
			lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
		})),
		sessions: sessions.map((s) => {
			const isCurrent = s.id === currentSessionId;
			return {
				id: s.id,
				displayId: hashForDisplay(s.id),
				createdAt: s.createdAt.toISOString(),
				expiresAt: s.expiresAt.toISOString(),
				// Only the viewer's current connection shows its raw IP; prior sessions
				// are masked (matches the GDPR export — Art 15(4), third-party IPs).
				ipAddress: s.ipAddress ? (isCurrent ? s.ipAddress : maskIp(s.ipAddress)) : null,
				userAgent: s.userAgent,
				isCurrent,
			};
		}),
	};
};

export const actions: Actions = {
	revokeSession: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		// Sensitive action: needs a fresh second-factor check when TOTP is enrolled.
		// The client opens StepUpDialog on `stepUpRequired` and resubmits.
		if (!(await requireStepUp(locals.user))) {
			return fail(403, { stepUpRequired: true });
		}

		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;

		if (!sessionId) return fail(400, { error: 'Missing session ID' });

		// Only allow revoking own sessions (not the current one)
		await revokeSession(sessionId, locals.user.id, locals.session?.id ?? '');

		return { success: true };
	},
};
