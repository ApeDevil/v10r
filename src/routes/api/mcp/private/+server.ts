/**
 * Hosted PRIVATE pattern MCP — `/api/mcp/private` (MCP Streamable HTTP).
 *
 * Same six pattern tools, same registry, same instructions as `/api/mcp/public` — the ONLY
 * differences are the `MCP_PRIVATE_TOKEN` bearer gate and the telemetry policy it unlocks: on
 * this surface the operator's own calls are recorded in full (question on every outcome, the
 * answer text, a self-declared workspace label) so their private projects' usage of the pattern
 * registry is observable at `/admin/mcp/usage`. It exists to make the operator's own consumption
 * observable, not to expose anything new: no tool defs, no new tools, no registry change.
 *
 * Rate limiting runs BEFORE auth so a failed credential can't be brute-forced at full
 * throughput. GET → 405 (SSE unsupported) with no auth and no tool metadata, so there is no
 * bearer-guessing path outside the rate-limited POST. CSRF exemption is automatic via the
 * `/api/mcp/` prefix (security/csrf.ts).
 */
import { json } from '@sveltejs/kit';
import { normalizeIpKey } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { type BearerCheck, verifyPrivateMcpBearer } from '$lib/server/mcp/auth';
import { mcpMethodNotAllowed, respondToMcpPost } from '$lib/server/mcp/http';
import { PUBLIC_MCP_INSTRUCTIONS, publicPatternRegistry } from '$lib/server/mcp/patterns/registry';
import { buildInfo } from '$lib/server/mcp/server-info';
import { createMcpObserver, recordMcpGateRejection } from '$lib/server/mcp/telemetry/observer';
import type { McpServerIdentity } from '$lib/server/mcp/transport';
import type { RequestHandler } from './$types';

/** See the public endpoint: the shared `waitUntil` budget is stated, not inherited. */
export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limiter = createLimiter('mcp-private', 120, '1 m');

function authFailure(check: Extract<BearerCheck, { ok: false }>): Response {
	const headers = check.status === 401 ? { 'WWW-Authenticate': 'Bearer realm="v10r-mcp-private"' } : undefined;
	return json({ error: { code: check.code, message: check.message } }, { status: check.status, headers });
}

// Full build info (commit SHA + env): this surface is authenticated, so the exact deployment
// identity is not a disclosure — unlike the public endpoint's deliberately coarse version.
function identity(): McpServerIdentity {
	return {
		name: 'v10r-mcp-private',
		version: buildInfo().app,
		instructions: PUBLIC_MCP_INSTRUCTIONS,
		meta: buildInfo(),
	};
}

/** GET is the optional SSE channel in Streamable HTTP; unsupported → 405 (unauthenticated). */
export const GET: RequestHandler = () => mcpMethodNotAllowed();

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const gateStartedAt = performance.now();
	const ip = getClientAddress();

	// Rate-limit BEFORE auth so failed-credential attempts are throttled too. Bucketed by /64 so
	// an IPv6 caller cannot rotate within its own allocation to widen the throttle in front of
	// the bearer check. `ip` stays raw for telemetry below.
	const { success, reset } = await limiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	// As on the other surfaces: a refused request writes nothing, so the limiter cannot be turned
	// into a write amplifier.
	if (!success) return rateLimitResponse(reset);

	const check = verifyPrivateMcpBearer(request);
	const gateMs = Math.round(performance.now() - gateStartedAt);

	const telemetryContext = {
		surface: 'private' as const,
		ip,
		headers: request.headers,
		gateMs,
		registryVersion: buildInfo().patternRegistry,
		knownTool: (name: string) => publicPatternRegistry.tools.some((tool) => tool.name === name),
		body: undefined,
	};

	if (!check.ok) {
		// A 401 here is a misconfigured operator or a scanner — never a recoverable client. 503
		// means the token is not configured at all: an operator problem, not a caller one.
		recordMcpGateRejection(telemetryContext, check.status === 503 ? 'unconfigured' : 'unauthorized');
		return authFailure(check);
	}

	return respondToMcpPost(request, publicPatternRegistry, identity(), createMcpObserver(telemetryContext));
};
