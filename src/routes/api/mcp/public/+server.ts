/**
 * Hosted PUBLIC read-only Pattern MCP — `/api/mcp/public` (MCP Streamable HTTP).
 *
 * No authentication. Structurally read-only: it is handed `publicPatternRegistry`, which
 * contains only the six Pattern tools — there is no mutation tool to dispatch, and a private
 * tool name submitted here is rejected by the transport's allowlist. IP-rate-limited.
 * GET → 405 (SSE is not supported); all interaction is POST.
 */
import { normalizeIpKey } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { mcpMethodNotAllowed, respondToMcpPost } from '$lib/server/mcp/http.adapter';
import { PUBLIC_MCP_INSTRUCTIONS, publicPatternRegistry } from '$lib/server/mcp/patterns/tools';
import { publicBuildInfo } from '$lib/server/mcp/server-info';
import { createMcpObserver } from '$lib/server/mcp/telemetry/observer';
import type { McpServerIdentity } from '$lib/server/mcp/transport';
import type { RequestHandler } from './$types';

/**
 * Stated rather than inherited. Deferred telemetry shares this budget with the request that
 * spawned it — Vercel cancels `waitUntil` promises when the function times out — so the number
 * being written down is the point. Sharing a budget you have written down is engineering; sharing
 * one you inherited is luck.
 */
export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limiter = createLimiter('mcp-public', 60, '1 m');

// Coarse version only on this unauthenticated surface — enough to identify the deployed v10r
// version, without leaking the exact commit SHA / environment to anonymous callers.
function identity(): McpServerIdentity {
	return {
		name: 'v10r-mcp-public',
		version: publicBuildInfo().app,
		instructions: PUBLIC_MCP_INSTRUCTIONS,
		meta: publicBuildInfo(),
	};
}

/** GET is the optional SSE channel in Streamable HTTP; unsupported → 405. */
export const GET: RequestHandler = () => mcpMethodNotAllowed();

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// `gate_ms` is the Upstash round trip, and it is on the path of EVERY request. Kept apart from
	// dispatch timing because public tool execution is pure CPU over a static registry — pool the
	// two and you conclude "the MCP is slow" when the rate limiter is the entire cost. It also
	// doubles as a security signal: > 1000ms means the limiter FAIL-OPENED and the limit was not
	// enforced for this request.
	const gateStartedAt = performance.now();
	const ip = getClientAddress();
	// Bucket by /64, not by address: an IPv6 client that rotates within its own
	// allocation would otherwise get a fresh bucket per request and the limiter
	// becomes decorative. `ip` itself stays raw below — telemetry wants the
	// address that actually connected, not the bucket it was counted in.
	const { success, reset } = await limiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	const gateMs = Math.round(performance.now() - gateStartedAt);

	// A rate-limited request writes NOTHING. The limiter exists to make refusal cheap; writing a row
	// on refusal would invert it into an amplifier, converting a flood into an equal number of
	// database inserts. Rejection volume is a counter's job, not a log's.
	if (!success) return rateLimitResponse(reset);

	// Built INSIDE the handler, never at module scope: it closes over this request's gate timing and
	// headers, so a shared instance would be cross-request contamination on a warm instance.
	const observer = createMcpObserver({
		surface: 'public',
		ip,
		headers: request.headers,
		gateMs,
		registryVersion: publicBuildInfo().patternRegistry,
		knownTool: (name) => publicPatternRegistry.tools.some((tool) => tool.name === name),
		body: undefined,
	});

	return respondToMcpPost(request, publicPatternRegistry, identity(), observer);
};
