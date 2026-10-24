import { beforeEach, describe, expect, it, vi } from 'vitest';

const { acknowledge, guard } = vi.hoisted(() => ({
	acknowledge: vi.fn(),
	guard: vi.fn<() => { user: { id: string } } | { error: Response }>(),
}));
vi.mock('#lib/server/auth/grants.ts', () => ({
	GRANT_KINDS: ['blog-author'],
	acknowledgeGrantNotifications: acknowledge,
}));
vi.mock('#lib/server/http/guards.ts', () => ({ guardApiUser: guard }));
vi.mock('#lib/server/http/rate-limit.ts', () => ({
	createLimiter: () => ({ limit: async () => ({ success: true }) }),
	rateLimitResponse: vi.fn(),
}));

const { POST } = await import('./+server');
const post = (body: unknown) =>
	POST({
		locals: {},
		request: new Request('https://example.test/api/grant-notifications/acknowledge', {
			method: 'POST',
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
	} as Parameters<typeof POST>[0]);

beforeEach(() => {
	vi.clearAllMocks();
	guard.mockReturnValue({ user: { id: 'user' } });
});

describe('grant notification acknowledgement HTTP contract', () => {
	it('rejects an anonymous caller before touching the domain', async () => {
		guard.mockReturnValueOnce({ error: new Response(null, { status: 401 }) });
		expect((await post({ kinds: ['blog-author'] })).status).toBe(401);
		expect(acknowledge).not.toHaveBeenCalled();
	});

	it('acknowledges the caller’s own kinds and answers 204', async () => {
		acknowledge.mockResolvedValueOnce(['blog-author']);
		expect((await post({ kinds: ['blog-author'] })).status).toBe(204);
		expect(acknowledge).toHaveBeenCalledExactlyOnceWith('user', ['blog-author']);
	});

	it('answers 204 when there was nothing left to acknowledge — repeats are no-ops, not errors', async () => {
		acknowledge.mockResolvedValueOnce([]);
		expect((await post({ kinds: ['blog-author'] })).status).toBe(204);
	});

	it('rejects malformed bodies: invalid JSON, no kinds, unknown kinds', async () => {
		expect((await post('not json')).status).toBe(400);
		expect((await post({ kinds: [] })).status).toBe(400);
		expect((await post({ kinds: ['admin'] })).status).toBe(400);
		expect(acknowledge).not.toHaveBeenCalled();
	});
});
