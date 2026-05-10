import { json } from '@sveltejs/kit';
import type { Decision } from './types';

export const allowed: Decision = { allowed: true };

export function denied(
	layer: 'altcha' | 'honeypot' | 'rate-limit',
	reason: string,
	status: 400 | 403 | 429,
	retryAfterMs?: number,
): Decision {
	return { allowed: false, layer, reason, status, retryAfterMs };
}

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
