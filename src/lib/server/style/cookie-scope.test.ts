import { describe, expect, it } from 'vitest';
import { STYLE_COOKIE_NAME } from '#lib/styles/random/index.ts';
import { rendersAppShell, scopeStyleCookie } from './cookie-scope';

const STYLE = `${STYLE_COOKIE_NAME}=%7B%22pid%22%3A%22x%22%7D; Path=/; Max-Age=31536000; SameSite=Lax`;
const LOCALE = 'PARAGLIDE_LOCALE=de; Path=/; SameSite=Lax';

function respond(contentType: string | null, cookies: string[]): Response {
	const headers = new Headers();
	if (contentType) headers.set('content-type', contentType);
	for (const line of cookies) headers.append('set-cookie', line);
	return new Response('body', { headers });
}

describe('rendersAppShell', () => {
	it('is true for an HTML page and for page data', () => {
		expect(rendersAppShell(respond('text/html', []), false)).toBe(true);
		expect(rendersAppShell(respond('application/json', []), true)).toBe(true);
	});

	it('is false for the crawler endpoints and a bodiless redirect', () => {
		for (const type of ['text/plain; charset=utf-8', 'application/xml', 'application/rss+xml', null]) {
			expect(rendersAppShell(respond(type, []), false), String(type)).toBe(false);
		}
	});
});

describe('scopeStyleCookie', () => {
	it('keeps the style cookie on a page', () => {
		const response = respond('text/html; charset=utf-8', [STYLE]);
		scopeStyleCookie(response, false);
		expect(response.headers.getSetCookie()).toEqual([STYLE]);
	});

	it('keeps the style cookie on page data', () => {
		const response = respond('application/json', [STYLE]);
		scopeStyleCookie(response, true);
		expect(response.headers.getSetCookie()).toEqual([STYLE]);
	});

	it('strips it from an endpoint so the response stays CDN-cacheable', () => {
		const response = respond('application/xml', [STYLE]);
		scopeStyleCookie(response, false);
		expect(response.headers.has('set-cookie')).toBe(false);
	});

	it('strips only the style cookie, never a cookie another handler set', () => {
		const response = respond('text/plain', [LOCALE, STYLE]);
		scopeStyleCookie(response, false);
		expect(response.headers.getSetCookie()).toEqual([LOCALE]);
	});

	it('does not mistake a cookie whose name merely starts the same way', () => {
		const lookalike = `${STYLE_COOKIE_NAME}_other=1; Path=/`;
		const response = respond('text/plain', [lookalike]);
		scopeStyleCookie(response, false);
		expect(response.headers.getSetCookie()).toEqual([lookalike]);
	});

	it('leaves a response with immutable headers alone', () => {
		const response = Response.redirect('https://example.com/elsewhere', 302);
		expect(() => scopeStyleCookie(response, false)).not.toThrow();
	});
});
