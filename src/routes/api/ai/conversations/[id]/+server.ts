import { json } from '@sveltejs/kit';
import { getConversation } from '$lib/server/db/ai/queries';
import { deleteConversation } from '$lib/server/db/ai/mutations';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const conv = await getConversation(params.id, user.id);
	if (!conv) {
		return json({ error: 'Conversation not found.' }, { status: 404 });
	}

	return json(conv);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const deleted = await deleteConversation(params.id, user.id);
	if (!deleted) {
		return json({ error: 'Conversation not found.' }, { status: 404 });
	}

	return json({ ok: true });
};
