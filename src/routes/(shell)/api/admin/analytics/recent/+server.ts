/**
 * Admin live-feed polling endpoint.
 * Returns events newer than `?since=<id>`, optionally filtered to paired sessions.
 */
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { requireAdmin } from '$lib/server/auth/guards';
import { getActiveSessionCount, getPairedSessionCount, getRecentEvents } from '$lib/server/db/analytics/queries';
import type { RequestHandler } from './$types';

export const config = { runtime: 'nodejs22.x', maxDuration: 10 };

const limit = createLimiter('rl:analytics:recent', 60, '60 s');

export const GET: RequestHandler = async ({ locals, url, setHeaders }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await limit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const sinceParam = url.searchParams.get('since');
	const sinceId = sinceParam ? Number.parseInt(sinceParam, 10) : 0;
	if (sinceParam && !Number.isFinite(sinceId)) {
		return apiError(400, 'invalid_query', 'Bad `since` value.');
	}

	const filterParam = url.searchParams.get('filter');
	const filter: 'all' | 'paired' = filterParam === 'paired' ? 'paired' : 'all';

	const limitParam = url.searchParams.get('limit');
	const limitN = limitParam ? Number.parseInt(limitParam, 10) : 50;
	if (limitParam && (!Number.isFinite(limitN) || limitN < 1 || limitN > 200)) {
		return apiError(400, 'invalid_query', '`limit` must be between 1 and 200.');
	}

	const [events, activeSessions, pairedSessions] = await Promise.all([
		getRecentEvents({ adminUserId: user.id, sinceId, filter, limit: limitN }),
		getActiveSessionCount(),
		getPairedSessionCount(user.id),
	]);

	const cursor = events.length > 0 ? String(events[events.length - 1].id) : String(sinceId);

	setHeaders({ 'Cache-Control': 'no-store' });

	return apiOk({
		events,
		cursor,
		hasMore: events.length === limitN,
		serverTime: new Date().toISOString(),
		activeSessions,
		pairedSessions,
	});
};
