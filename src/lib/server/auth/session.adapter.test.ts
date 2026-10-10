import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cookie cache only caches if the cookies `getSession()` writes reach the browser.
 * A direct `auth.api.getSession()` call discards them unless it asks for its headers,
 * which is how every signed-in request ended up paying the session lookup five minutes
 * after sign-in. These tests pin the forwarding, not Better Auth's session logic.
 */

const getSession = vi.hoisted(() => vi.fn());
vi.mock('./index', () => ({ auth: { api: { getSession } } }));

const { forwardSetCookies, readRequestSession } = await import('./session.adapter');

function jar() {
	return { set: vi.fn() };
}

function event(cookies = jar()) {
	return {
		request: new Request('https://example.com/blog', { headers: { cookie: 'better-auth.session_token=abc.sig' } }),
		cookies,
	};
}

const SESSION = { user: { id: 'u1' }, session: { id: 's1', token: 'abc' } };

beforeEach(() => {
	getSession.mockReset();
});

describe('readRequestSession', () => {
	it('asks Better Auth for its response headers', async () => {
		getSession.mockResolvedValue({ headers: new Headers(), response: SESSION });
		const e = event();
		await readRequestSession(e);
		expect(getSession).toHaveBeenCalledWith({ headers: e.request.headers, returnHeaders: true });
	});

	it('forwards a cache refresh onto event.cookies and returns the session', async () => {
		const headers = new Headers();
		headers.append(
			'set-cookie',
			'better-auth.session_data=eyJzZXNzaW9uIjp7fX0%3D; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax',
		);
		getSession.mockResolvedValue({ headers, response: SESSION });

		const cookies = jar();
		const result = await readRequestSession(event(cookies));

		expect(result).toBe(SESSION);
		expect(cookies.set).toHaveBeenCalledWith(
			'better-auth.session_data',
			// Decoded here; SvelteKit's cookies.set re-encodes on the way out.
			'eyJzZXNzaW9uIjp7fX0=',
			expect.objectContaining({ maxAge: 300, path: '/', httpOnly: true, secure: true, sameSite: 'lax' }),
		);
	});

	it('forwards a refreshed session_token alongside the cache cookie', async () => {
		const headers = new Headers();
		headers.append('set-cookie', '__Secure-better-auth.session_token=tok.sig; Max-Age=604800; Path=/; HttpOnly');
		headers.append('set-cookie', '__Secure-better-auth.session_data=payload; Max-Age=300; Path=/; HttpOnly');
		getSession.mockResolvedValue({ headers, response: SESSION });

		const cookies = jar();
		await readRequestSession(event(cookies));

		expect(cookies.set.mock.calls.map(([name]) => name)).toEqual([
			'__Secure-better-auth.session_token',
			'__Secure-better-auth.session_data',
		]);
		expect(cookies.set.mock.calls[0][2]).toMatchObject({ maxAge: 604800 });
	});

	it('forwards the expiry Better Auth writes for a session that no longer exists', async () => {
		const headers = new Headers();
		headers.append('set-cookie', 'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly');
		getSession.mockResolvedValue({ headers, response: null });

		const cookies = jar();
		expect(await readRequestSession(event(cookies))).toBeNull();
		expect(cookies.set).toHaveBeenCalledWith('better-auth.session_token', '', expect.objectContaining({ maxAge: 0 }));
	});

	it('writes nothing on a cache hit', async () => {
		getSession.mockResolvedValue({ headers: new Headers(), response: SESSION });
		const cookies = jar();
		await readRequestSession(event(cookies));
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('rejects as getSession does, leaving the degrade policy to the caller', async () => {
		getSession.mockRejectedValue(new Error('neon down'));
		await expect(readRequestSession(event())).rejects.toThrow('neon down');
	});
});

describe('forwardSetCookies', () => {
	it('defaults the path SvelteKit requires', () => {
		const cookies = jar();
		forwardSetCookies(new Headers({ 'set-cookie': 'a=1; HttpOnly' }), cookies);
		expect(cookies.set).toHaveBeenCalledWith('a', '1', expect.objectContaining({ path: '/' }));
	});

	it('tolerates absent headers', () => {
		const cookies = jar();
		forwardSetCookies(undefined, cookies);
		forwardSetCookies(null, cookies);
		expect(cookies.set).not.toHaveBeenCalled();
	});
});
