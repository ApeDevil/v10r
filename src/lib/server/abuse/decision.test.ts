import { describe, expect, it } from 'vitest';
import { allowed, denied } from './decision';
import { authDecisionResponse, decisionResponse } from './decision.adapter';

describe('decisionResponse', () => {
	it('keeps the nested apiError contract for general API surfaces', async () => {
		const res = decisionResponse(denied('altcha', 'Missing captcha solution', 400));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: { code: 'captcha_required', message: 'Missing captcha solution' } });
	});

	it('throws when called on an allowed decision', () => {
		expect(() => decisionResponse(allowed)).toThrow();
	});
});

describe('authDecisionResponse', () => {
	it('answers in the auth dialect — top-level code and message', async () => {
		const res = authDecisionResponse(denied('altcha', 'Invalid or replayed captcha', 403));
		expect(res.status).toBe(403);
		const body = await res.json();
		// The Better Auth client reads body.message / body.code at the top level;
		// a nested shape here regresses every gate denial into generic UI copy.
		expect(body.code).toBe('captcha_required');
		expect(body.message).toBe('Invalid or replayed captcha');
		expect(body.error).toBeUndefined();
	});

	it('carries retryAfterSeconds in body and Retry-After header on rate limits', async () => {
		const res = authDecisionResponse(denied('rate-limit', 'Too many requests for this email.', 429, 150_000));
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('150');
		const body = await res.json();
		expect(body).toEqual({
			code: 'rate_limited',
			message: 'Too many requests for this email.',
			retryAfterSeconds: 150,
		});
	});

	it('omits retryAfterSeconds when the decision has no retry window', async () => {
		const res = authDecisionResponse(denied('honeypot', 'Invalid request', 400));
		expect(res.headers.get('Retry-After')).toBeNull();
		const body = await res.json();
		expect(body).toEqual({ code: 'invalid_request', message: 'Invalid request' });
	});

	it('throws when called on an allowed decision', () => {
		expect(() => authDecisionResponse(allowed)).toThrow();
	});
});
