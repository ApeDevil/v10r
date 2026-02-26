import { json } from '@sveltejs/kit';
import { getDocument } from '$lib/server/db/rag/queries';
import { deleteDocument } from '$lib/server/db/rag/mutations';
import { deleteDocumentGraph } from '$lib/server/graph/rag/mutations';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const doc = await getDocument(params.id, user.id);
		if (!doc) {
			return json({ error: 'Document not found.' }, { status: 404 });
		}
		return json({ document: doc });
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return json({ error: 'Failed to fetch document' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const deleted = await deleteDocument(params.id, user.id);
		if (!deleted) {
			return json({ error: 'Document not found.' }, { status: 404 });
		}

		// Clean up graph data (non-critical)
		try {
			await deleteDocumentGraph(params.id);
		} catch (graphErr) {
			console.error('[api:retrieval:documents] Graph cleanup failed:', graphErr instanceof Error ? graphErr.message : graphErr);
		}

		return json({ deleted: true });
	} catch (err) {
		console.error('[api:retrieval:documents] Error:', err instanceof Error ? err.message : err);
		return json({ error: 'Failed to delete document' }, { status: 500 });
	}
};
