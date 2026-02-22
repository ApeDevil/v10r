import { json } from '@sveltejs/kit';
import { listConversations, createConversation } from '$lib/server/db/ai/mutations';
import { checkConversationLimit } from '$lib/server/db/ai/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required.' }, { status: 401 });
	}

	const conversations = await listConversations(locals.user.id);
	return json(conversations);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required.' }, { status: 401 });
	}

	const allowed = await checkConversationLimit(locals.user.id);
	if (!allowed) {
		return json({ error: 'Conversation limit reached. Delete old conversations to continue.' }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const title = typeof body.title === 'string' ? body.title : undefined;

	const conv = await createConversation(locals.user.id, title);
	return json(conv, { status: 201 });
};
