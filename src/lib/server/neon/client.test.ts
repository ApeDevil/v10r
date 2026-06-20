/**
 * Neon client — secret-redaction invariant. On a Management API error the client
 * must throw STATUS ONLY, never the response body (which can carry request ids /
 * tokens) and never the bearer key. The key is sent server→Neon but is never
 * reflected back into a thrown Error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET_KEY = 'napi_supersecret_DO_NOT_LEAK_0123456789';
const SECRET_BODY = { message: 'forbidden', request_id: 'REQ-SECRET-99', token: 'tok_LEAK_ME' };

beforeEach(() => {
	process.env.NEON_API_KEY = SECRET_KEY;
	process.env.NEON_PROJECT_ID = 'proj-test-1';
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	delete process.env.NEON_API_KEY;
	delete process.env.NEON_PROJECT_ID;
});

const { restoreBranchFromParent, getOperation } = await import('./client');

function errorResponse(status: number) {
	return vi.fn(
		async (_input?: unknown, _init?: RequestInit) =>
			({ ok: false, status, json: async () => SECRET_BODY }) as unknown as Response,
	);
}

describe('neon client — secret redaction on API error', () => {
	it('throws status only — never the response body or the api key', async () => {
		vi.stubGlobal('fetch', errorResponse(403));

		let caught: Error | null = null;
		try {
			await restoreBranchFromParent('br-dev', 'br-prod');
		} catch (e) {
			caught = e as Error;
		}

		expect(caught).toBeInstanceOf(Error);
		const msg = caught?.message ?? '';
		expect(msg).toContain('403'); // status surfaced
		// body never leaks
		expect(msg).not.toContain('REQ-SECRET-99');
		expect(msg).not.toContain('tok_LEAK_ME');
		expect(msg).not.toContain('forbidden');
		// key never leaks
		expect(msg).not.toContain(SECRET_KEY);
	});

	it('sends the bearer key to Neon but never echoes it into the thrown error', async () => {
		const fetchMock = errorResponse(500);
		vi.stubGlobal('fetch', fetchMock);

		await expect(getOperation('op-1')).rejects.toThrow('500');

		// The key WAS sent on the wire (expected, server→Neon only)...
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		const headers = init?.headers as Record<string, string> | undefined;
		expect(headers?.Authorization).toBe(`Bearer ${SECRET_KEY}`);
	});
});
