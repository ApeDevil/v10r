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
import { normalizeIpKey } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { type BearerCheck, verifyAdminMcpBearer } from '$lib/server/mcp/auth';
import {
	ADMIN_MCP_ACTOR,
	ADMIN_MCP_INSTRUCTIONS,
	ADMIN_STATE_TOOLS,
	createAdminStateRegistry,
} from '$lib/server/mcp/demo/tools';
import { mcpMethodNotAllowed, respondToMcpPost } from '$lib/server/mcp/http.adapter';
import { buildInfo } from '$lib/server/mcp/server-info';
import { createMcpObserver, recordMcpGateRejection } from '$lib/server/mcp/telemetry/observer';
import type { McpServerIdentity } from '$lib/server/mcp/transport';
import type { RequestHandler } from './$types';

/** See the public endpoint: the shared `waitUntil` budget is stated, not inherited. */
export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

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
	const gateStartedAt = performance.now();
	const ip = getClientAddress();

	// Rate-limit BEFORE auth so failed-credential attempts are throttled too. Bucketed
	// by /64 so an IPv6 caller cannot rotate within its own allocation to widen the
	// throttle in front of the bearer check. `ip` stays raw for telemetry and the
	// registry actor below.
	const { success, reset } = await limiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	// As on the public surface: a refused request writes nothing, so the limiter cannot be turned
	// into a write amplifier.
	if (!success) return rateLimitResponse(reset);

	const check = verifyAdminMcpBearer(request);
	const gateMs = Math.round(performance.now() - gateStartedAt);

	const telemetryContext = {
		surface: 'admin' as const,
		ip,
		headers: request.headers,
		gateMs,
		registryVersion: buildInfo().patternRegistry,
		knownTool: (name: string) => ADMIN_STATE_TOOLS.some((tool) => tool.name === name),
		body: undefined,
	};

	if (!check.ok) {
		// A 401 here is a misconfigured operator or a scanner — never a recoverable client, since no
		// off-the-shelf MCP client can negotiate a static bearer. It belongs beside the rate-limit
		// counters as a security signal, not beside tool errors. 503 means the token is not
		// configured at all, which is an operator problem rather than a caller one.
		recordMcpGateRejection(telemetryContext, check.status === 503 ? 'unconfigured' : 'unauthorized');
		return authFailure(check);
	}

	const registry = createAdminStateRegistry({ ...ADMIN_MCP_ACTOR, ip });
	return respondToMcpPost(request, registry, identity(), createMcpObserver(telemetryContext));
};
