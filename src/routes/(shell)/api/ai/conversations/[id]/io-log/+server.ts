import { apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { getConversationIOLog } from '$lib/server/db/ai/io-log-queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { user } = requireApiUser(locals);

	const rawLimit = Number(url.searchParams.get('limit') ?? 100);
	const rawOffset = Number(url.searchParams.get('offset') ?? 0);
	const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 200);
	const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

	const result = await getConversationIOLog(params.id, user.id, limit, offset);
	return apiOk(result);
};
