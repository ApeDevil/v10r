/**
 * Bearer authentication for the authenticated MCP surfaces. Two realms share one verifier:
 *  - admin   (`/api/mcp/admin`)   — credential in `MCP_ADMIN_TOKEN`
 *  - private (`/api/mcp/private`) — credential in `MCP_PRIVATE_TOKEN`
 * Each realm reads its own env var and only that var — a valid admin token never opens the
 * private surface or vice versa. The credentials are machine secrets, never committed.
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

/** Recommended minimum length for a surface token (≈256-bit base64). */
const MIN_TOKEN_LENGTH = 32;
/** Keyed by env var name — a single boolean would swallow whichever realm warns second. */
const warnedWeakTokens = new Set<string>();

interface McpBearerRealm {
	/** The configured secret — read from `$env/dynamic/private` by the per-realm wrapper. */
	configured: string | undefined;
	/** Env var NAME, for the 503 message and the weak-token warning only. Never the value. */
	envName: string;
	/** Error-code prefix: `mcp_admin` | `mcp_private`. */
	codePrefix: string;
	/** Human name of the surface for the 503 message. */
	surfaceLabel: string;
}

export function verifyMcpBearer(request: Request, realm: McpBearerRealm): BearerCheck {
	const { configured, envName, codePrefix, surfaceLabel } = realm;
	if (!configured) {
		return {
			ok: false,
			status: 503,
			code: `${codePrefix}_unconfigured`,
			message: `${surfaceLabel} is not configured on this server (${envName} is unset).`,
		};
	}
	if (!warnedWeakTokens.has(envName) && configured.length < MIN_TOKEN_LENGTH) {
		warnedWeakTokens.add(envName);
		console.warn(
			`[mcp] ${envName} is shorter than ${MIN_TOKEN_LENGTH} chars — use a high-entropy secret (e.g. \`openssl rand -base64 32\`).`,
		);
	}
	const token = extractBearer(request.headers.get('authorization'));
	if (!token || !constantTimeEqual(token, configured)) {
		return {
			ok: false,
			status: 401,
			code: `${codePrefix}_unauthorized`,
			message: 'Missing or invalid bearer credentials.',
		};
	}
	return { ok: true };
}

export function verifyAdminMcpBearer(request: Request): BearerCheck {
	return verifyMcpBearer(request, {
		configured: env.MCP_ADMIN_TOKEN,
		envName: 'MCP_ADMIN_TOKEN',
		codePrefix: 'mcp_admin',
		surfaceLabel: 'Admin MCP',
	});
}

export function verifyPrivateMcpBearer(request: Request): BearerCheck {
	return verifyMcpBearer(request, {
		configured: env.MCP_PRIVATE_TOKEN,
		envName: 'MCP_PRIVATE_TOKEN',
		codePrefix: 'mcp_private',
		surfaceLabel: 'Private MCP',
	});
}
