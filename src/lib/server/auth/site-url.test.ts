import { describe, expect, it } from 'vitest';
import { DEV_SITE_URL, resolveSiteUrl } from './site-url';

describe('resolveSiteUrl', () => {
	it('uses the configured value in every mode', () => {
		expect(resolveSiteUrl('https://www.example.com', false).origin).toBe('https://www.example.com');
		expect(resolveSiteUrl('https://www.example.com', true).origin).toBe('https://www.example.com');
	});

	it('defaults to the Vite dev server in dev', () => {
		expect(resolveSiteUrl(undefined, true).href).toBe(new URL(DEV_SITE_URL).href);
		expect(resolveSiteUrl('', true).origin).toBe('http://localhost:5173');
	});

	it('refuses to guess outside dev', () => {
		expect(() => resolveSiteUrl(undefined, false)).toThrow(/BETTER_AUTH_URL/);
		expect(() => resolveSiteUrl('', false)).toThrow(/BETTER_AUTH_URL/);
	});

	it('rejects a value that is not a URL', () => {
		expect(() => resolveSiteUrl('www.example.com', false)).toThrow();
	});
});
