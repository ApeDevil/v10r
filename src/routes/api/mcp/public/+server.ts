/**
 * Hosted PUBLIC read-only Pattern MCP — `/api/mcp/public` (MCP Streamable HTTP).
 *
 * No authentication. Structurally read-only: it is handed `publicPatternRegistry`, which
 * contains only the five Pattern tools — there is no mutation tool to dispatch, and a private
 * tool name submitted here is rejected by the transport's allowlist. IP-rate-limited.
 * GET → 405 (SSE is not supported); all interaction is POST.
 */
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { mcpMethodNotAllowed, respondToMcpPost } from '$lib/server/mcp/http';
import { PUBLIC_MCP_INSTRUCTIONS, publicPatternRegistry } from '$lib/server/mcp/patterns/registry';
import { publicBuildInfo } from '$lib/server/mcp/server-info';
import type { McpServerIdentity } from '$lib/server/mcp/transport';
import type { RequestHandler } from './$types';

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
	const { success, reset } = await limiter.limit(`ip:${getClientAddress()}`);
	if (!success) return rateLimitResponse(reset);
	return respondToMcpPost(request, publicPatternRegistry, identity());
};
