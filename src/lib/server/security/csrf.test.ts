import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	CSRF_EXEMPT_PREFIXES,
	isCrossSiteFormSubmission,
	isSameHost,
	needsCsrf,
	OAUTH_SERVER_TO_SERVER_PATHS,
} from './csrf';

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

	it('skips non-/api paths (form actions are covered by crossSiteFormCheck)', () => {
		expect(needsCsrf('POST', '/account/settings')).toBe(false);
		expect(needsCsrf('POST', '/blog')).toBe(false);
	});

	it('exempts each prefix that carries its own auth', () => {
		expect(needsCsrf('POST', '/api/auth/sign-in/magic-link')).toBe(false);
		expect(needsCsrf('GET', '/api/cron/cleanup')).toBe(false);
		expect(needsCsrf('POST', '/api/webhooks/telegram')).toBe(false);
		expect(needsCsrf('POST', '/api/analytics/journey')).toBe(false);
		// MCP over HTTP: admin=Bearer, public=unauthenticated read-only — no ambient cookie auth,
		// and non-browser MCP clients can't send X-Requested-With.
		expect(needsCsrf('POST', '/api/mcp/public')).toBe(false);
		expect(needsCsrf('POST', '/api/mcp/admin')).toBe(false);
		expect(needsCsrf('POST', '/api/mcp/private')).toBe(false);
	});

	it('still protects non-exempt routes that merely share a parent segment', () => {
		// e.g. /api/analytics/stream is NOT the exempt /api/analytics/journey
		expect(needsCsrf('POST', '/api/analytics/stream')).toBe(true);
	});

	it('exempts a child of a slashless entry', () => {
		expect(needsCsrf('POST', '/api/analytics/journey/collect')).toBe(false);
		expect(needsCsrf('POST', '/api/analytics/journey/confirm')).toBe(false);
	});

	it('does NOT exempt a route whose path merely BEGINS with a slashless entry', () => {
		// The trap the missing trailing slash left behind. None of these exist
		// today — which is the point: the entry that silently widens the exempt
		// set is the one added later by someone who never opens this file.
		expect(needsCsrf('POST', '/api/analytics/journeys')).toBe(true);
		expect(needsCsrf('POST', '/api/analytics/journey-admin')).toBe(true);
		expect(needsCsrf('POST', '/api/analytics/journeyexport')).toBe(true);
	});

	it('keeps trailing-slash entries matching exactly as before', () => {
		expect(needsCsrf('POST', '/api/mcp/public')).toBe(false);
		expect(needsCsrf('POST', '/api/mcp')).toBe(false);
		expect(needsCsrf('POST', '/api/mcpx')).toBe(true);
		expect(needsCsrf('POST', '/api/a2a')).toBe(false);
		expect(needsCsrf('POST', '/api/a2ax')).toBe(true);
		expect(needsCsrf('POST', '/api/authx/steal')).toBe(true);
	});

	it('locks the exempt set — a new exempt prefix must be a deliberate change', () => {
		expect([...CSRF_EXEMPT_PREFIXES]).toEqual([
			'/api/auth/',
			'/api/cron/',
			'/api/webhooks/',
			'/api/analytics/journey',
			'/api/a2a',
			'/api/mcp/',
		]);
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

describe('isCrossSiteFormSubmission (SvelteKit’s rule, owned by the app)', () => {
	const SELF = 'https://www.v10r.dev';
	const form = 'application/x-www-form-urlencoded';
	const request = (over: Partial<Parameters<typeof isCrossSiteFormSubmission>[0]>) => ({
		method: 'POST',
		path: '/account/settings',
		contentType: form,
		origin: SELF,
		selfOrigin: SELF,
		...over,
	});

	it('refuses a form action posted from another origin, or with no Origin at all', () => {
		expect(isCrossSiteFormSubmission(request({ origin: 'https://evil.example' }))).toBe(true);
		expect(isCrossSiteFormSubmission(request({ origin: null }))).toBe(true);
		for (const contentType of [
			'multipart/form-data; boundary=x',
			'text/plain',
			'application/x-sveltekit-formdata',
			null,
		]) {
			expect(isCrossSiteFormSubmission(request({ origin: 'https://evil.example', contentType }))).toBe(true);
		}
		for (const method of ['PUT', 'PATCH', 'DELETE']) {
			expect(isCrossSiteFormSubmission(request({ method, origin: 'https://evil.example' }))).toBe(true);
		}
	});

	it('allows same-origin forms, safe methods and non-form bodies, exactly as SvelteKit did', () => {
		expect(isCrossSiteFormSubmission(request({}))).toBe(false);
		expect(isCrossSiteFormSubmission(request({ method: 'GET', origin: null }))).toBe(false);
		expect(isCrossSiteFormSubmission(request({ contentType: 'application/json', origin: null }))).toBe(false);
	});

	it('lets an MCP host exchange its code (and revoke or introspect) server-to-server', () => {
		// The request ChatGPT's server sends: form-encoded, no Origin. SvelteKit answered 403.
		for (const path of OAUTH_SERVER_TO_SERVER_PATHS) {
			expect(isCrossSiteFormSubmission(request({ path, origin: null }))).toBe(false);
		}
		// Only those: the consent page and the rest of Better Auth keep the rule.
		expect(isCrossSiteFormSubmission(request({ path: '/auth/authorize', origin: null }))).toBe(true);
		expect(isCrossSiteFormSubmission(request({ path: '/api/auth/oauth2/consent', origin: null }))).toBe(true);
		expect(isCrossSiteFormSubmission(request({ path: '/api/auth/oauth2/token/x', origin: null }))).toBe(true);
	});

	it('replaces the framework check, which is switched off (order: handle-chain.gate.test.ts)', () => {
		expect(readFileSync('vite.config.ts', 'utf8')).toContain("csrf: { trustedOrigins: ['*'] }");
		expect(readFileSync('src/hooks.server.ts', 'utf8')).toContain('isCrossSiteFormSubmission({');
	});
});
