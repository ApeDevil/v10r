import { describe, expect, it } from 'vitest';
import { isAuthorizationResumePath, sanitizeInternalPath } from '#lib/utils/safe-path.ts';
import { authorizationResumePath } from './authorization-request';

const signed = new URLSearchParams({
	response_type: 'code',
	client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
	redirect_uri: 'http://localhost:33418/callback',
	code_challenge: 'abc',
	code_challenge_method: 'S256',
	scope: 'mcp:3d:use offline_access',
	resource: 'https://v10r.dev/api/mcp/3d',
	state: 's1',
	exp: '1700000000',
	ba_iat: '1699999000',
	sig: 'signature',
});

describe('authorizationResumePath', () => {
	it('keeps the original request and drops the signature parameters', () => {
		const resume = authorizationResumePath(signed);
		expect(resume).not.toBeNull();
		const url = new URL(resume as string, 'https://v10r.dev');
		expect(url.pathname).toBe('/api/auth/oauth2/authorize');
		expect(url.searchParams.get('code_challenge')).toBe('abc');
		expect(url.searchParams.get('resource')).toBe('https://v10r.dev/api/mcp/3d');
		for (const key of ['sig', 'exp', 'ba_iat']) expect(url.searchParams.has(key)).toBe(false);
	});

	it('is null for an ordinary login or an unsigned lookalike', () => {
		expect(authorizationResumePath(new URLSearchParams({ returnTo: '/account' }))).toBeNull();
		const unsigned = new URLSearchParams(signed);
		unsigned.delete('sig');
		expect(authorizationResumePath(unsigned)).toBeNull();
		const implicit = new URLSearchParams(signed);
		implicit.set('response_type', 'token');
		expect(authorizationResumePath(implicit)).toBeNull();
	});

	it('produces a path that survives returnTo sanitization with its query intact', () => {
		const resume = authorizationResumePath(signed) as string;
		expect(isAuthorizationResumePath(resume)).toBe(true);
		expect(sanitizeInternalPath(resume)).toBe(resume);
	});

	it('does not treat another path as a resume path', () => {
		expect(isAuthorizationResumePath('/api/auth/oauth2/authorizeX?a=1')).toBe(false);
		expect(isAuthorizationResumePath('//evil.example/api/auth/oauth2/authorize')).toBe(false);
	});
});
