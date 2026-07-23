/**
 * Bearer authentication for the private admin MCP endpoint. The credential is a machine
 * secret configured via the `MCP_ADMIN_TOKEN` server environment variable — never committed.
 *
 * Failure modes are explicit and never fall back to public behavior:
 *  - token unset on the server  → 503 (misconfiguration, not the caller's fault)
 *  - header missing / malformed → 401
 *  - token present but wrong     → 401 (constant-time compare)
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export type BearerCheck = { ok: true } | { ok: false; status: 401 | 503; code: string; message: string };

/**
 * Constant-time equality with no length branch: both inputs are reduced to a fixed-length
 * SHA-256 digest first, so `timingSafeEqual` always compares equal-length buffers regardless of
 * the candidate/configured token lengths. This removes the early `length` return that leaked
 * whether the guess had the right size. The digests never leave this function.
 */
function constantTimeEqual(a: string, b: string): boolean {
	const digestA = createHash('sha256').update(a, 'utf8').digest();
	const digestB = createHash('sha256').update(b, 'utf8').digest();
	return timingSafeEqual(digestA, digestB);
}

/** Pull the token out of an `Authorization: Bearer <token>` header (scheme case-insensitive). */
export function extractBearer(header: string | null): string | null {
	if (!header) return null;
	const match = /^Bearer[ ]+(.+)$/i.exec(header.trim());
	return match ? match[1].trim() : null;
}

/** Recommended minimum length for the admin token (≈256-bit base64). */
const MIN_TOKEN_LENGTH = 32;
let warnedWeakToken = false;

export function verifyAdminMcpBearer(request: Request): BearerCheck {
	const configured = env.MCP_ADMIN_TOKEN;
	if (!configured) {
		return {
			ok: false,
			status: 503,
			code: 'mcp_admin_unconfigured',
			message: 'Admin MCP is not configured on this server (MCP_ADMIN_TOKEN is unset).',
		};
	}
	if (!warnedWeakToken && configured.length < MIN_TOKEN_LENGTH) {
		warnedWeakToken = true;
		console.warn(
			`[mcp] MCP_ADMIN_TOKEN is shorter than ${MIN_TOKEN_LENGTH} chars — use a high-entropy secret (e.g. \`openssl rand -base64 32\`).`,
		);
	}
	const token = extractBearer(request.headers.get('authorization'));
	if (!token || !constantTimeEqual(token, configured)) {
		return {
			ok: false,
			status: 401,
			code: 'mcp_admin_unauthorized',
			message: 'Missing or invalid bearer credentials.',
		};
	}
	return { ok: true };
}
