import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import { listConversations } from '$lib/server/db/ai/queries';
import { createConversation } from '$lib/server/db/ai/mutations';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { CreateConversationSchema } from '$lib/server/ai/validation';
import { requireApiUser } from '$lib/server/auth/guards';
import { classifyDbError } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const conversations = await listConversations(user.id);
		return json(conversations);
	} catch (err) {
		const dbErr = classifyDbError(err);
		return json({ error: dbErr.message }, { status: dbErr.toStatus() });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const limitError = await checkConversationLimit(user.id);
	if (limitError) {
		return json({ error: limitError }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateConversationSchema, body);
	const title = parsed.success ? parsed.output.title : undefined;

	try {
		const conv = await createConversation(user.id, title);
		return json(conv, { status: 201 });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return json({ error: dbErr.message }, { status: dbErr.toStatus() });
	}
};
