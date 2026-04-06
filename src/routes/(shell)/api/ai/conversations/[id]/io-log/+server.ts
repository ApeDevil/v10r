import { json } from '@sveltejs/kit';
import { getConversationIOLog } from '$lib/server/db/ai/io-log-queries';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { user } = requireApiUser(locals);

	const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 200);
	const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

	const result = await getConversationIOLog(params.id, user.id, limit, offset);
	return json(result);
};
