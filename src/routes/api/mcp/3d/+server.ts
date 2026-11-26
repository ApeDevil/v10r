/**
 * MCP 3D — `/api/mcp/3d` (MCP Streamable HTTP): the stateless parametric modeling service.
 *
 * A separate MCP service, not part of the Pattern MCP: its own identity (`v10r-mcp-3d`),
 * instructions, tool registry (`#lib/server/mcp/modeling/tools.ts`), 3D Viewer App and limits,
 * served by the same protocol infrastructure (`respondToMcpPost`, the official SDK).
 *
 * Protected: an OAuth protected resource (scope `mcp:3d:use`, audience = this URL). Every
 * JSON-RPC request — `initialize`, `tools/list`, the model-visible tools and the app-only
 * `render_model` alike — passes the same layers, in this order, before the SDK parses a body:
 *
 *  1. per-IP entry limit     — cheap DoS hygiene for anything, authenticated or not. Generous,
 *                              because MCP hosts call from shared egress ranges.
 *  2. resource access        — `verifyResourceAccess`: 401/403 challenges, audience, scope,
 *                              and the per-request liveness check (revocation, suspension).
 *  3. per-account limits     — a per-minute rate and a daily allowance, keyed by the
 *                              Velociraptor user id, so several clients of one user share one
 *                              allowance and a shared host IP is never the quota identity.
 *  4. surface limit          — one ceiling on the whole service across all accounts.
 *  5. in-flight bound        — simultaneous evaluations per instance and per account.
 *  6. per-call budgets       — schema limits, size estimate, triangle/byte budget, deadline
 *                              (`MCP_3D_BUDGET`, `MCP_3D_RUN_MS`), inside the tools.
 *
 * No telemetry: model definitions are the caller's work and are not recorded anywhere —
 * nothing here logs arguments, the limiter keys are ids, and the authorization rows never see
 * a model. GET → 405 (SSE is not supported). Decision record: docs/blueprint/architecture/mcp-authorization.md.
 */
import { normalizeIpKey } from '#lib/server/abuse/index.ts';
import { MCP_3D_SERVICE } from '#lib/server/auth/protected-mcp-services.ts';
import { verifyResourceAccess } from '#lib/server/auth/resource-access.ts';
import { createInFlightLimit } from '#lib/server/http/in-flight-limit.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { mcpMethodNotAllowed, respondToMcpPost } from '#lib/server/mcp/http.adapter.ts';
import { MCP_3D_INSTRUCTIONS, MCP_3D_QUOTA, modelingRegistry } from '#lib/server/mcp/modeling/tools.ts';
import { publicBuildInfo } from '#lib/server/mcp/server-info.ts';
import { noopMcpObserver } from '#lib/server/mcp/types.ts';
import type { McpServerIdentity } from '#mcp/tool-server.ts';
import type { RequestHandler } from './$types';

/** One evaluation is bounded at 8 s (`MCP_3D_RUN_MS`); the rest is kernel compile on a cold start. */
export const config = { runtime: 'nodejs22.x', maxDuration: 30 };

const perAddress = createLimiter('mcp-3d-ip', MCP_3D_QUOTA.perAddressPerMinute, '1 m');
const perAccount = createLimiter('mcp-3d-user', MCP_3D_QUOTA.perAccountPerMinute, '1 m');
const perAccountDaily = createLimiter('mcp-3d-user-day', MCP_3D_QUOTA.perAccountPerDay, '1 d');
/** A ceiling on the whole surface, so many accounts cannot add up to unbounded compute. */
const everyone = createLimiter('mcp-3d-all', MCP_3D_QUOTA.surfacePerMinute, '1 m');
const inFlight = createInFlightLimit(MCP_3D_QUOTA.inFlightPerInstance, MCP_3D_QUOTA.inFlightPerAccount);

function identity(): McpServerIdentity {
	return {
		name: 'v10r-mcp-3d',
		version: publicBuildInfo().app,
		instructions: MCP_3D_INSTRUCTIONS,
		meta: publicBuildInfo(),
		cacheScope: 'private',
	};
}

function busy(): Response {
	return Response.json(
		{ error: { code: 'busy', message: 'The modeling service is at capacity. Retry shortly.' } },
		{ status: 503, headers: { 'Retry-After': '2' } },
	);
}

export const GET: RequestHandler = () => mcpMethodNotAllowed();

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const ip = getClientAddress();
	const entry = await perAddress.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	if (!entry.success) return rateLimitResponse(entry.reset);

	const access = await verifyResourceAccess(request, MCP_3D_SERVICE);
	if (!access.ok) return access.response;
	const account = `user:${access.caller.userId}`;

	const minute = await perAccount.limit(account);
	if (!minute.success) return rateLimitResponse(minute.reset);
	const day = await perAccountDaily.limit(account);
	if (!day.success) return rateLimitResponse(day.reset, 'The daily modeling allowance for this account is used up.');
	const surface = await everyone.limit('all');
	if (!surface.success) return rateLimitResponse(surface.reset);

	const leave = inFlight.tryEnter(account);
	if (!leave) return busy();
	try {
		const registry = modelingRegistry(new URL(request.url).origin);
		return await respondToMcpPost(request, registry, identity(), noopMcpObserver);
	} finally {
		leave();
	}
};
