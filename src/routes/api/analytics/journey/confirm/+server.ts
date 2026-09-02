/**
 * Human-confirmation ping ingest — the corroboration half of the counting model.
 *
 * One constant-payload POST per document load marks the caller's session as
 * JS-corroborated (`sessions.human_confirmed_at`). Sessions without it stay in
 * the unconfirmed bucket, which is where UA-spoofing crawler traffic lands.
 *
 * DELIBERATELY CONSENT-FREE, unlike its siblings. The request carries a token
 * the client cannot read anything out of, and the endpoint reads nothing from
 * terminal equipment below the `analytics` tier — the consented session cookie
 * is only consulted once `hasConsent` says its read is covered. Without it,
 * the session id is re-derived server-side (`deriveCookielessSessionId`), the
 * same construction the pageview hook already uses at that tier. That is what
 * lets a consent-declining human be counted as confirmed at all; with the
 * consent gate its siblings have, "confirmed" would silently collapse to
 * "consented".
 *
 * Nested under `/api/analytics/journey` so it inherits that prefix's CSRF
 * exemption (sendBeacon cannot set headers) and its Origin-check contract.
 *
 * Every refusal is a silent 204: a 4xx would make this endpoint an oracle for
 * probing which tokens verify.
 */
import * as v from 'valibot';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { isBot } from '$lib/analytics/collect-policy';
import { normalizeIpKey } from '$lib/server/abuse';
import { SESSION_COOKIE } from '$lib/server/analytics/config';
import { verifyConfirmToken } from '$lib/server/analytics/confirm-token';
import { deriveCookielessSessionId, hasConsent } from '$lib/server/analytics/consent';
import { deriveVisitorId } from '$lib/server/analytics/visitor';
import { confirmSession } from '$lib/server/db/analytics/mutations';
import { MAX_BEACON_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiNoContent } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const ConfirmBody = v.object({
	token: v.pipe(v.string(), v.maxLength(128)),
});

/** One ping per document load — 30/min absorbs a tab-restoring session comfortably. */
const limiter = createLimiter('rl:analytics:confirm', 30, '1 m', { onError: 'open' });

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, locals, url }) => {
	// Same dev gate as the other collectors: one database for every environment.
	if (dev && env.ANALYTICS_DEV_TRACKING !== 'true') {
		return apiNoContent();
	}

	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return apiError(403, 'forbidden', 'Cross-origin beacon rejected');
	}

	// A declared bot that runs JS must not confirm itself into the human bucket.
	const ua = request.headers.get('user-agent') ?? '';
	if (isBot(ua)) return apiNoContent();

	const ip = locals.clientIp ?? getClientAddress();
	const { success, reset } = await limiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	if (!success) return rateLimitResponse(reset);

	const read = await readJsonBounded(request, MAX_BEACON_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_BEACON_BODY_BYTES);
		return apiNoContent();
	}

	const parsed = v.safeParse(ConfirmBody, read.value);
	if (!parsed.success) return apiNoContent();

	// The token is HMAC-bound to the visitor hash of the connection it was issued
	// to; re-deriving here is what makes a farmed token useless elsewhere.
	const visitorId = await deriveVisitorId(ip, ua);
	if (!verifyConfirmToken(parsed.output.token, visitorId)) return apiNoContent();

	// Consented cookie session when its read is covered; the cookieless daily id
	// otherwise — mirroring exactly which session row the hook wrote for this
	// visitor at each tier.
	const cookieSid = hasConsent(locals.consentTier, 'analytics') ? cookies.get(SESSION_COOKIE) : undefined;
	const sessionId = cookieSid ?? (await deriveCookielessSessionId(visitorId));

	await confirmSession(sessionId).catch(() => {});
	return apiNoContent();
};
