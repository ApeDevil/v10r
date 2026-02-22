import { json } from '@sveltejs/kit';
import { listDocuments } from '$lib/server/db/rag/mutations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to view documents.' }, { status: 401 });
	}

	const documents = await listDocuments(locals.user.id);
	return json({ documents });
};
