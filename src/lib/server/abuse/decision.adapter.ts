/**
 * Renders an abuse `Decision` as an HTTP response.
 *
 * Split from `abuse/decision.ts` so the decision *constructors* stay framework-free and
 * callable from any client type, while only the rendering knows about `Response`.
 *
 * `LAYER_CODE` lives here rather than beside `denied()` because the layer name is the
 * domain fact and the wire code is a presentation detail of this one transport.
 */
import { json } from '@sveltejs/kit';
import type { Decision } from './types';

const LAYER_CODE: Record<'altcha' | 'honeypot' | 'rate-limit', string> = {
	altcha: 'captcha_required',
	honeypot: 'invalid_request',
	'rate-limit': 'rate_limited',
};

/**
 * Convert a denied Decision into a JSON Response matching the apiError contract.
 * Throws if called on an allowed Decision — guard with `!d.allowed` first.
 */
export function decisionResponse(d: Decision): Response {
	if (d.allowed) throw new Error('decisionResponse called on allowed decision');
	const headers: Record<string, string> = {};
	if (d.retryAfterMs !== undefined) {
		headers['Retry-After'] = String(Math.ceil(d.retryAfterMs / 1000));
	}
	return json({ error: { code: LAYER_CODE[d.layer], message: d.reason } }, { status: d.status, headers });
}

/**
 * Denial in Better Auth's error dialect, for gates in front of /api/auth/*.
 * The auth client SDK reads TOP-LEVEL `code`/`message` from the body — the
 * nested apiError shape above renders as a blank message there, so every
 * denial collapses into the UI's generic fallback copy.
 */
export function authDecisionResponse(d: Decision): Response {
	if (d.allowed) throw new Error('authDecisionResponse called on allowed decision');
	const headers: Record<string, string> = {};
	const retryAfterSeconds = d.retryAfterMs !== undefined ? Math.ceil(d.retryAfterMs / 1000) : undefined;
	if (retryAfterSeconds !== undefined) {
		headers['Retry-After'] = String(retryAfterSeconds);
	}
	return json(
		{ code: LAYER_CODE[d.layer], message: d.reason, ...(retryAfterSeconds !== undefined && { retryAfterSeconds }) },
		{ status: d.status, headers },
	);
}
