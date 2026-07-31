/**
 * Phone-side pairing landing. Public route (no auth required).
 *
 * The GET load is deliberately read-only: the QR encodes this URL, so link
 * prefetchers, email/chat scanners, and hover-preload would consume the
 * single-use code if the claim ran in `load` (GETs are outside SvelteKit's
 * CSRF origin check). The page renders a one-tap confirm form instead; the
 * POST action does the actual claim.
 *
 * Flow (POST ?/claim):
 *   1. IP rate limit — before any DB round-trip (the per-code attempt counter
 *      constrains nothing against a keyspace sweep).
 *   2. Read or mint a session id (sets _v10r_sid if absent).
 *   3. Claim the code → tag session with admin id, set debug-owner cookie.
 *   4. Redirect to / on success; render failure copy otherwise.
 */
import { fail, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { getClientIp, ipLimitKey } from '$lib/server/abuse';
import { createLimiter } from '$lib/server/api/rate-limit';
import { ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { claimPairingCode, PAIRED_SESSION_TTL_MS, setOwnerCookie, signOwnerCookie } from '$lib/server/pairing';
import type { Actions, PageServerLoad } from './$types';

const CODE_SHAPE = /^[2-9]{6}$/;

const claimLimiter = createLimiter('rl:pair:claim', 10, '1 m');

export const load: PageServerLoad = async ({ params }) => {
	if (!CODE_SHAPE.test(params.code)) {
		return { failure: 'invalid' as const };
	}
	return { code: params.code };
};

export const actions: Actions = {
	claim: async (event) => {
		const { params, cookies } = event;

		const { success } = await claimLimiter.limit(ipLimitKey(getClientIp(event)));
		if (!success) {
			return fail(429, { failure: 'rate_limited' as const });
		}

		if (!CODE_SHAPE.test(params.code)) {
			return fail(400, { failure: 'invalid' as const });
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

		const result = await claimPairingCode(params.code, sessionId);
		if (!result.ok) {
			return fail(400, { failure: result.reason });
		}

		const expiresAt = Date.now() + PAIRED_SESSION_TTL_MS;
		const cookieValue = await signOwnerCookie(result.adminUserId, expiresAt);
		setOwnerCookie(cookies, cookieValue, expiresAt);

		redirect(303, localizeHref('/'));
	},
};
