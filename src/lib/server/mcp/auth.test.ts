import { afterEach, describe, expect, it } from 'vitest';
import { extractBearer, verifyAdminMcpBearer } from './auth';

const TOKEN = 'super-secret-machine-token-1234567890';

function req(authorization?: string): Request {
	return new Request('http://localhost/api/mcp/admin', {
		method: 'POST',
		headers: authorization ? { authorization } : {},
	});
}

afterEach(() => {
	delete process.env.MCP_ADMIN_TOKEN;
});

describe('extractBearer', () => {
	it('pulls the token from a well-formed header', () => {
		expect(extractBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
	});
	it('is scheme-case-insensitive', () => {
		expect(extractBearer(`bearer ${TOKEN}`)).toBe(TOKEN);
	});
	it('returns null for a non-bearer scheme or missing header', () => {
		expect(extractBearer(`Basic ${TOKEN}`)).toBeNull();
		expect(extractBearer(null)).toBeNull();
		expect(extractBearer('Bearer ')).toBeNull();
	});
});

describe('verifyAdminMcpBearer', () => {
	it('accepts the correct token', () => {
		process.env.MCP_ADMIN_TOKEN = TOKEN;
		expect(verifyAdminMcpBearer(req(`Bearer ${TOKEN}`))).toEqual({ ok: true });
	});

	it('rejects a missing Authorization header with 401', () => {
		process.env.MCP_ADMIN_TOKEN = TOKEN;
		const result = verifyAdminMcpBearer(req());
		expect(result).toMatchObject({ ok: false, status: 401 });
	});

	it('rejects a wrong token with 401', () => {
		process.env.MCP_ADMIN_TOKEN = TOKEN;
		const result = verifyAdminMcpBearer(req('Bearer not-the-token'));
		expect(result).toMatchObject({ ok: false, status: 401 });
	});

	it('rejects candidates of any length via fixed-length digest compare (no length branch)', () => {
		process.env.MCP_ADMIN_TOKEN = TOKEN;
		// Shorter, longer, and a same-length-but-wrong candidate all reject; only the exact token passes.
		expect(verifyAdminMcpBearer(req('Bearer x'))).toMatchObject({ ok: false, status: 401 });
		expect(verifyAdminMcpBearer(req(`Bearer ${TOKEN}${TOKEN}`))).toMatchObject({ ok: false, status: 401 });
		expect(verifyAdminMcpBearer(req(`Bearer ${'z'.repeat(TOKEN.length)}`))).toMatchObject({ ok: false, status: 401 });
		expect(verifyAdminMcpBearer(req(`Bearer ${TOKEN}`))).toEqual({ ok: true });
	});

	it('returns 503 when the server has no token configured — never falls through to success', () => {
		delete process.env.MCP_ADMIN_TOKEN;
		const result = verifyAdminMcpBearer(req(`Bearer ${TOKEN}`));
		expect(result).toMatchObject({ ok: false, status: 503 });
	});

	it('still authenticates a short (weak) token — the low-entropy warning does not break auth', () => {
		process.env.MCP_ADMIN_TOKEN = 'short-weak';
		expect(verifyAdminMcpBearer(req('Bearer short-weak'))).toEqual({ ok: true });
		expect(verifyAdminMcpBearer(req('Bearer wrong'))).toMatchObject({ ok: false, status: 401 });
	});
});
