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
