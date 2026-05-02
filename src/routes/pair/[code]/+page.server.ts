/**
 * Phone-side pairing landing. Public route (no auth required).
 *
 * Flow:
 *   1. Read or mint a session id (sets _v10r_sid if absent).
 *   2. Claim the code → tag session with admin id, set debug-owner cookie.
 *   3. Redirect to / on success; render error page on failure.
 */
import { redirect } from '@sveltejs/kit';
import { ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { claimPairingCode, PAIRED_SESSION_TTL_MS, setOwnerCookie, signOwnerCookie } from '$lib/server/pairing';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const code = params.code;

	if (!/^[2-9]{6}$/.test(code)) {
		return { failure: 'invalid' as const };
	}

	// Ensure the phone has a session id — mint if absent so the visitor row
	// produced by analyticsCollector on subsequent navigations is the one we tag.
	let sessionId = cookies.get('_v10r_sid');
	if (!sessionId) {
		sessionId = `s_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
		cookies.set('_v10r_sid', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: ANALYTICS_SESSION_TIMEOUT_MS / 1000,
		});
	}

	const result = await claimPairingCode(code, sessionId);
	if (!result.ok) {
		return { failure: result.reason };
	}

	const expiresAt = Date.now() + PAIRED_SESSION_TTL_MS;
	const cookieValue = await signOwnerCookie(result.adminUserId, expiresAt);
	setOwnerCookie(cookies, cookieValue, expiresAt);

	throw redirect(303, '/');
};
