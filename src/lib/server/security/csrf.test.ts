import { describe, expect, it } from 'vitest';
import { CSRF_EXEMPT_PREFIXES, isSameHost, needsCsrf } from './csrf';

describe('needsCsrf', () => {
	it('requires CSRF on mutating /api/ requests', () => {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			expect(needsCsrf(method, '/api/desk/files')).toBe(true);
		}
	});

	it('skips safe methods', () => {
		for (const method of ['GET', 'HEAD', 'OPTIONS']) {
			expect(needsCsrf(method, '/api/desk/files')).toBe(false);
		}
	});

	it('skips non-/api paths (form actions are covered by SvelteKit checkOrigin)', () => {
		expect(needsCsrf('POST', '/account/settings')).toBe(false);
		expect(needsCsrf('POST', '/blog')).toBe(false);
	});

	it('exempts each prefix that carries its own auth', () => {
		expect(needsCsrf('POST', '/api/auth/sign-in/magic-link')).toBe(false);
		expect(needsCsrf('GET', '/api/cron/cleanup')).toBe(false);
		expect(needsCsrf('POST', '/api/webhooks/telegram')).toBe(false);
		expect(needsCsrf('POST', '/api/analytics/journey')).toBe(false);
	});

	it('still protects non-exempt routes that merely share a parent segment', () => {
		// e.g. /api/analytics/stream is NOT the exempt /api/analytics/journey
		expect(needsCsrf('POST', '/api/analytics/stream')).toBe(true);
	});

	it('locks the exempt set — a new exempt prefix must be a deliberate change', () => {
		expect([...CSRF_EXEMPT_PREFIXES]).toEqual(['/api/auth/', '/api/cron/', '/api/webhooks/', '/api/analytics/journey']);
	});
});

describe('isSameHost', () => {
	const host = 'app.example.com';

	it('accepts same host', () => {
		expect(isSameHost('https://app.example.com/x', host)).toBe(true);
		expect(isSameHost('https://app.example.com:443', host)).toBe(true); // 443 is https default → normalized away
	});

	it('rejects a non-default explicit port', () => {
		expect(isSameHost('https://app.example.com:8443', host)).toBe(false);
	});

	it('rejects a foreign origin', () => {
		expect(isSameHost('https://evil.com', host)).toBe(false);
	});

	it('rejects a subdomain (host comparison, not domain suffix)', () => {
		expect(isSameHost('https://evil.app.example.com', host)).toBe(false);
	});

	it('rejects null and malformed values', () => {
		expect(isSameHost(null, host)).toBe(false);
		expect(isSameHost('not-a-url', host)).toBe(false);
		expect(isSameHost('', host)).toBe(false);
	});
});
