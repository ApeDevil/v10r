import { json } from '@sveltejs/kit';
import { listDocuments } from '$lib/server/db/rag/mutations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to view documents.' }, { status: 401 });
	}

	try {
		const documents = await listDocuments(locals.user.id);
		return json({ documents });
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return json({ error: 'Failed to list documents' }, { status: 500 });
	}
};
