import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import { listConversations, createConversation } from '$lib/server/db/ai/mutations';
import { checkConversationLimit } from '$lib/server/db/ai/guards';
import { CreateConversationSchema } from '$lib/server/ai/validation';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const conversations = await listConversations(user.id);
	return json(conversations);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const allowed = await checkConversationLimit(user.id);
	if (!allowed) {
		return json({ error: 'Conversation limit reached. Delete old conversations to continue.' }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateConversationSchema, body);
	const title = parsed.success ? parsed.output.title : undefined;

	const conv = await createConversation(user.id, title);
	return json(conv, { status: 201 });
};
