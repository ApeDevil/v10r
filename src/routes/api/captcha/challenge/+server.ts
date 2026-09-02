import { BOT_DETECTION_MODE, ipLimitKey } from '$lib/server/abuse';
import { altchaChallengeHandler } from '$lib/server/abuse/altcha';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

/**
 * ALTCHA challenge issuance.
 *
 * The widget fetches this endpoint, solves the proof-of-work, then submits the
 * payload to whichever endpoint requires verification. Per-IP rate-limit
 * prevents stockpiling: pre-solved challenges still expire and each is single-
 * use via the Redis replay store on verification.
 */
const challengeLimiter = createLimiter('rl:captcha:challenge', 30, '60 s');

export const GET: RequestHandler = async (event) => {
	if (BOT_DETECTION_MODE === 'off') {
		return apiError(503, 'service_disabled', 'Captcha is disabled');
	}

	const { success, reset } = await challengeLimiter.limit(ipLimitKey(getClientIp(event)));
	if (!success) return rateLimitResponse(reset);

	return altchaChallengeHandler();
};
