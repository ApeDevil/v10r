import { json } from '@sveltejs/kit';
import { requireApiUser } from '$lib/server/auth/guards';
import { markAllAsRead } from '$lib/server/db/notifications/mutations';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const count = await markAllAsRead(user.id);
		return json({ success: true, count });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return json({ error: safeDbMessage(dbErr.kind) }, { status: dbErr.toStatus() });
	}
};
