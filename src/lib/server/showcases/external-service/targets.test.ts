import { describe, expect, it } from 'vitest';
import { isPrivateHost, resolveServiceTarget } from './targets';

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
		[{ url: 'https://svc.example', token: `${TOKEN}€` }, 'malformed_token'],
		[{ url: 'https://svc.example', token: `${TOKEN.slice(0, 10)} ${TOKEN.slice(10)}` }, 'malformed_token'],
	])('refuses %o as %s', (raw, problem) => {
		expect(resolveServiceTarget('remote', raw)).toEqual({ id: 'remote', setup: 'misconfigured', problem });
	});

	it('allows plain http for local only to hosts off the public internet', () => {
		for (const url of [
			'http://order-rules:8080',
			'http://127.0.0.1:8787',
			'http://localhost:8787',
			'http://192.168.1.20',
			'http://[::1]:8787',
		]) {
			expect(resolveServiceTarget('local', { url, token: TOKEN }).setup, url).toBe('configured');
		}
		for (const url of ['http://order-rules.example.com', 'http://8.8.8.8', 'http://172.32.0.1']) {
			expect(resolveServiceTarget('local', { url, token: TOKEN }), url).toMatchObject({ problem: 'insecure_url' });
		}
		expect(resolveServiceTarget('local', { url: 'https://order-rules.example.com', token: TOKEN }).setup).toBe(
			'configured',
		);
	});

	it.each([
		['localhost', true],
		['app.localhost', true],
		['10.0.0.5', true],
		['172.16.0.1', true],
		['172.31.255.255', true],
		['192.168.0.1', true],
		['[::1]', true],
		['[fd00::1]', true],
		['order-rules', true],
		['172.15.0.1', false],
		['example.com', false],
		['[2001:db8::1]', false],
	])('isPrivateHost(%s) → %s', (host, expected) => {
		expect(isPrivateHost(host)).toBe(expected);
	});

	it('keeps a trailing slash as the bare origin', () => {
		const resolved = resolveServiceTarget('local', { url: 'http://127.0.0.1:8787/', token: TOKEN });
		expect(resolved.setup === 'configured' && resolved.target.origin).toBe('http://127.0.0.1:8787');
	});
});
