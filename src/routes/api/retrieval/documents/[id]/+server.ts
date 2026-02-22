import { json } from '@sveltejs/kit';
import { getDocument, deleteDocument } from '$lib/server/db/rag/mutations';
import { deleteDocumentGraph } from '$lib/server/graph/rag/mutations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to view documents.' }, { status: 401 });
	}

	const doc = await getDocument(params.id, locals.user.id);
	if (!doc) {
		return json({ error: 'Document not found.' }, { status: 404 });
	}

	return json({ document: doc });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to delete documents.' }, { status: 401 });
	}

	const deleted = await deleteDocument(params.id, locals.user.id);
	if (!deleted) {
		return json({ error: 'Document not found.' }, { status: 404 });
	}

	// Clean up graph data (non-critical)
	try {
		await deleteDocumentGraph(params.id);
	} catch (err) {
		console.error('[api:retrieval:documents] Graph cleanup failed:', err);
	}

	return json({ deleted: true });
};
