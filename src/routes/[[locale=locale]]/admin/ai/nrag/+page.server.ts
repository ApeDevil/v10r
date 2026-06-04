import { fail } from '@sveltejs/kit';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import { adminDeleteDocument, adminResetDocument } from '$lib/server/db/rag/admin-mutations';
import {
	getChunkCoverage,
	getCollectionsAdmin,
	getDocumentsAdmin,
	getDocumentsBySource,
	getErrorDocuments,
	getRAGOverviewStats,
} from '$lib/server/db/rag/admin-queries';
import { getLlmwikiAdminStats } from '$lib/server/db/rag/llmwiki-admin-queries';
import { getRagGraphStats } from '$lib/server/graph/rag/queries';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const status = url.searchParams.get('status') || 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [overview, errorDocs, llmwiki, bySource, coverage] = await Promise.all([
		getRAGOverviewStats(),
		getErrorDocuments(),
		getLlmwikiAdminStats(),
		getDocumentsBySource(),
		getChunkCoverage(),
	]);

	// Neo4j (Aura) is a separate connection — an Aura timeout must never 500 the
	// Postgres-backed page. Degrade to `graph: null` → "graph unavailable" panel.
	let graph: { nodes: number; edges: number } | null = null;
	try {
		const g = await getRagGraphStats();
		graph = { nodes: g.nodes, edges: g.edges };
	} catch (err) {
		console.error('[admin:nrag] graph stats unavailable:', err);
	}

	return {
		title: 'nRAG',
		overview,
		errorDocs,
		llmwiki,
		bySource,
		coverage,
		graph,
		filters: { status, page },
		documents: safeDeferPromise(getDocumentsAdmin({ status: status !== 'all' ? status : undefined, page }), {
			entries: [],
			total: 0,
			totalPages: 1,
		}),
		collections: safeDeferPromise(getCollectionsAdmin(), []),
	};
};

export const actions: Actions = {
	deleteDocument: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const documentId = formData.get('documentId') as string;

		if (!documentId) return fail(400, { message: 'Document ID required' });

		const doc = await adminDeleteDocument(documentId);
		if (!doc) return fail(404, { message: 'Document not found' });

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'rag.document.delete',
			targetType: 'document',
			targetId: documentId,
			detail: { title: doc.title },
		});

		return { success: true, message: `Deleted "${doc.title}".` };
	},

	resetDocument: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const documentId = formData.get('documentId') as string;

		if (!documentId) return fail(400, { message: 'Document ID required' });

		const doc = await adminResetDocument(documentId);
		if (!doc) return fail(404, { message: 'Document not found' });

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'rag.document.reset',
			targetType: 'document',
			targetId: documentId,
			detail: { title: doc.title },
		});

		return { success: true, message: `Reset "${doc.title}" to pending.` };
	},
};
