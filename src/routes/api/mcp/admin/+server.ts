/**
 * Hosted PRIVATE admin MCP — `/api/mcp/admin` (MCP Streamable HTTP).
 *
 * POST requires the `MCP_ADMIN_TOKEN` bearer credential; rate limiting runs BEFORE auth so a
 * failed credential can't be brute-forced at full throughput. Missing/invalid/misconfigured
 * credentials fail with 401/503 and never fall back to public behavior. GET → 405 (SSE
 * unsupported) with no auth and no tool metadata, so there is no bearer-guessing path outside
 * the rate-limited POST. It is handed only `adminStateRegistry`; the public pattern tools are
 * not reachable here.
 */
import { json } from '@sveltejs/kit';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { type BearerCheck, verifyAdminMcpBearer } from '$lib/server/mcp/auth';
import { ADMIN_MCP_ACTOR, ADMIN_MCP_INSTRUCTIONS, createAdminStateRegistry } from '$lib/server/mcp/demo/tools';
import { mcpMethodNotAllowed, respondToMcpPost } from '$lib/server/mcp/http';
import { buildInfo } from '$lib/server/mcp/server-info';
import type { McpServerIdentity } from '$lib/server/mcp/transport';
import type { RequestHandler } from './$types';

const limiter = createLimiter('mcp-admin', 120, '1 m');

function authFailure(check: Extract<BearerCheck, { ok: false }>): Response {
	const headers = check.status === 401 ? { 'WWW-Authenticate': 'Bearer realm="v10r-mcp-admin"' } : undefined;
	return json({ error: { code: check.code, message: check.message } }, { status: check.status, headers });
}

function identity(): McpServerIdentity {
	return {
		name: 'v10r-mcp-admin',
		version: buildInfo().app,
		instructions: ADMIN_MCP_INSTRUCTIONS,
		meta: buildInfo(),
	};
}

/** GET is the optional SSE channel in Streamable HTTP; unsupported → 405 (unauthenticated). */
export const GET: RequestHandler = () => mcpMethodNotAllowed();

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Rate-limit BEFORE auth so failed-credential attempts are throttled too.
	const { success, reset } = await limiter.limit(`ip:${getClientAddress()}`);
	if (!success) return rateLimitResponse(reset);

	const check = verifyAdminMcpBearer(request);
	if (!check.ok) return authFailure(check);

	const registry = createAdminStateRegistry({ ...ADMIN_MCP_ACTOR, ip: getClientAddress() });
	return respondToMcpPost(request, registry, identity());
};
