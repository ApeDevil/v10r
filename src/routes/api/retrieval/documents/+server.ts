import { json } from '@sveltejs/kit';
import { listDocuments } from '$lib/server/db/rag/mutations';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const documents = await listDocuments(user.id);
		return json({ documents });
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return json({ error: 'Failed to list documents' }, { status: 500 });
	}
};
