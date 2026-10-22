import { describe, expect, it } from 'vitest';
import { resolveServiceTarget } from './targets';

const TOKEN = 'targets-test-credential-0123456789abcdef';

describe('resolveServiceTarget', () => {
	it('treats an absent target as unconfigured, not as an error', () => {
		expect(resolveServiceTarget('remote', { url: undefined, token: undefined })).toEqual({
			id: 'remote',
			setup: 'unconfigured',
		});
		expect(resolveServiceTarget('local', { url: '  ', token: '' }).setup).toBe('unconfigured');
	});

	it('accepts an https origin for remote and plain http for local only', () => {
		expect(resolveServiceTarget('remote', { url: 'https://order-rules.onrender.com', token: TOKEN })).toEqual({
			id: 'remote',
			setup: 'configured',
			target: { id: 'remote', origin: 'https://order-rules.onrender.com', token: TOKEN },
		});
		expect(resolveServiceTarget('local', { url: 'http://order-rules:8080', token: TOKEN }).setup).toBe('configured');
		expect(resolveServiceTarget('remote', { url: 'http://order-rules.onrender.com', token: TOKEN })).toMatchObject({
			setup: 'misconfigured',
			problem: 'insecure_url',
		});
	});

	it.each([
		[{ url: 'https://svc.example', token: undefined }, 'incomplete'],
		[{ url: undefined, token: TOKEN }, 'incomplete'],
		[{ url: 'not a url', token: TOKEN }, 'invalid_url'],
		[{ url: 'ftp://svc.example', token: TOKEN }, 'invalid_url'],
		[{ url: 'https://svc.example/v1', token: TOKEN }, 'not_an_origin'],
		[{ url: 'https://svc.example/?to=elsewhere', token: TOKEN }, 'not_an_origin'],
		[{ url: 'https://user:pass@svc.example', token: TOKEN }, 'not_an_origin'],
		[{ url: 'https://svc.example', token: 'short' }, 'short_token'],
	])('refuses %o as %s', (raw, problem) => {
		expect(resolveServiceTarget('remote', raw)).toEqual({ id: 'remote', setup: 'misconfigured', problem });
	});

	it('keeps a trailing slash as the bare origin', () => {
		const resolved = resolveServiceTarget('local', { url: 'http://127.0.0.1:8787/', token: TOKEN });
		expect(resolved.setup === 'configured' && resolved.target.origin).toBe('http://127.0.0.1:8787');
	});
});
