import { json } from '@sveltejs/kit';
import { getConversation, deleteConversation } from '$lib/server/db/ai/mutations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required.' }, { status: 401 });
	}

	const conv = await getConversation(params.id, locals.user.id);
	if (!conv) {
		return json({ error: 'Conversation not found.' }, { status: 404 });
	}

	return json(conv);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required.' }, { status: 401 });
	}

	const deleted = await deleteConversation(params.id, locals.user.id);
	if (!deleted) {
		return json({ error: 'Conversation not found.' }, { status: 404 });
	}

	return json({ ok: true });
};
