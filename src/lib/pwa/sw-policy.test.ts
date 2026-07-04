import { describe, expect, it } from 'vitest';
import { isImmutableAsset, mayCache, shouldHandle } from './sw-policy';

const ORIGIN = 'https://www.v10r.dev';

describe('shouldHandle', () => {
	it('handles plain same-origin GET pages', () => {
		expect(shouldHandle(new Request(`${ORIGIN}/showcases`))).toBe(true);
	});

	it('refuses every non-GET method', () => {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			expect(shouldHandle(new Request(`${ORIGIN}/anything`, { method }))).toBe(false);
		}
	});

	it('refuses all /api/ paths (REST, auth, cron, SSE endpoints)', () => {
		expect(shouldHandle(new Request(`${ORIGIN}/api/notifications/stream`))).toBe(false);
		expect(shouldHandle(new Request(`${ORIGIN}/api/auth/callback/google`))).toBe(false);
		expect(shouldHandle(new Request(`${ORIGIN}/api/me`))).toBe(false);
	});

	it('refuses SSE requests by accept header even off /api/', () => {
		const req = new Request(`${ORIGIN}/some/stream`, {
			headers: { accept: 'text/event-stream' },
		});
		expect(shouldHandle(req)).toBe(false);
	});
});

describe('isImmutableAsset', () => {
	it('accepts hashed build assets', () => {
		expect(isImmutableAsset(new URL(`${ORIGIN}/_app/immutable/chunks/abc123.js`))).toBe(true);
	});

	it('refuses immutable-looking URLs carrying a query string (cache-deception guard)', () => {
		expect(isImmutableAsset(new URL(`${ORIGIN}/_app/immutable/chunks/abc123.js?__pathname=/api/me`))).toBe(false);
	});

	it('refuses non-immutable paths, including admin and data requests', () => {
		expect(isImmutableAsset(new URL(`${ORIGIN}/admin/audit`))).toBe(false);
		expect(isImmutableAsset(new URL(`${ORIGIN}/showcases/__data.json`))).toBe(false);
	});
});

describe('mayCache', () => {
	// Constructed Responses report type 'default'; real same-origin fetch
	// responses are 'basic' — model that so the fixture matches reality.
	const ok = (headers: Record<string, string> = {}, type = 'basic') => {
		const response = new Response('x', { status: 200, headers });
		Object.defineProperty(response, 'type', { value: type });
		return response;
	};

	it('accepts a clean same-origin (basic) 200', () => {
		expect(mayCache(ok())).toBe(true);
	});

	it('refuses anything that is not a basic response (opaque, synthetic)', () => {
		expect(mayCache(ok({}, 'opaque'))).toBe(false);
		expect(mayCache(new Response('x', { status: 200 }))).toBe(false); // type 'default'
	});

	it('refuses non-2xx and error responses', () => {
		expect(mayCache(new Response('x', { status: 404 }))).toBe(false);
		expect(mayCache(new Response('x', { status: 500 }))).toBe(false);
	});

	it('refuses no-store / private responses (the authed-response stamp)', () => {
		expect(mayCache(ok({ 'cache-control': 'no-store, private' }))).toBe(false);
		expect(mayCache(ok({ 'cache-control': 'private, max-age=3600' }))).toBe(false);
	});

	it('refuses responses that set cookies', () => {
		expect(mayCache(ok({ 'set-cookie': 'session=abc' }))).toBe(false);
	});
});
