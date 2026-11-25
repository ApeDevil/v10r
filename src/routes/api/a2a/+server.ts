/**
 * A2A JSON-RPC endpoint — `/api/a2a` — for v10r's architecture review agent.
 *
 * Public and unauthenticated, like the public pattern MCP: the agent runs deterministic checks
 * over the model in the request and reads or writes nothing else — no database, no user data,
 * no task kept after the response (`#lib/server/a2a/transport.ts`). IP-rate-limited before any
 * parsing; the body is size-capped in the adapter. CSRF-exempt (`security/csrf.ts`): there is no
 * ambient cookie authority to ride, and agent clients cannot send X-Requested-With.
 */

import { a2aMethodNotAllowed, respondToA2aPost } from '#lib/server/a2a/index.ts';
import { normalizeIpKey } from '#lib/server/abuse/index.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import type { RequestHandler } from './$types';

/** The checks take milliseconds; the budget is written down rather than inherited. */
export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limiter = createLimiter('a2a-public', 30, '1 m');

export const GET: RequestHandler = () => a2aMethodNotAllowed();

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const ip = getClientAddress();
	// Bucketed by /64 for IPv6, as the public MCP endpoint: a rotating address inside one
	// allocation would otherwise get a fresh bucket per request.
	const { success, reset } = await limiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	if (!success) return rateLimitResponse(reset);
	return respondToA2aPost(request, url.origin);
};
