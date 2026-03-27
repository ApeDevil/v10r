import { json } from '@sveltejs/kit';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import { API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { listDocuments } from '$lib/server/db/rag/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:retrieval:documents', API_READ_RATE_LIMIT_MAX, API_READ_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const documents = await listDocuments(user.id);
		return json({ documents });
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return json({ error: 'Failed to list documents' }, { status: 500 });
	}
};
