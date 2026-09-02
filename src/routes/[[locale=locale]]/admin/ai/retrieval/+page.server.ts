import { fail } from '@sveltejs/kit';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { RETRIEVAL_PAGE_SIZE } from '$lib/server/admin/config';
import { adminDeleteDocument, adminResetDocument } from '$lib/server/db/retrieval/admin-mutations';
import {
	getChunkCoverage,
	getCollectionsAdmin,
	getDocumentsAdmin,
	getDocumentsBySource,
	getErrorDocuments,
	getRetrievalOverviewStats,
} from '$lib/server/db/retrieval/admin-queries';
import { getLlmwikiAdminStats } from '$lib/server/db/retrieval/llmwiki-admin-queries';
import { getRetrievalGraphStats } from '$lib/server/graph/retrieval/queries';
import { safeDeferPromise } from '$lib/server/http/defer';
import { requireAdmin } from '$lib/server/http/guards';
import { SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = requireAdmin(locals);

	const status = url.searchParams.get('status') || 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// Neo4j (Aura) is a separate connection — an Aura timeout must never 500 the
	// Postgres-backed page, so the graph stat degrades to null inside the parallel
	// wave (its rejection is caught locally and can't fail the other five reads).
	const [overview, errorDocs, llmwiki, bySource, coverage, graph] = await Promise.all([
		getRetrievalOverviewStats(),
		getErrorDocuments(),
		getLlmwikiAdminStats(),
		getDocumentsBySource(),
		getChunkCoverage(),
		getRetrievalGraphStats([user.id, SYSTEM_DOCS_USER_ID])
			.then((g) => ({ nodes: g.nodes, edges: g.edges }))
			.catch((err) => {
				console.error('[admin:retrieval] graph stats unavailable:', err);
				return null;
			}),
	]);

	return {
		title: 'Retrieval',
		overview,
		errorDocs,
		llmwiki,
		bySource,
		coverage,
		graph,
		filters: { status, page },
		documents: safeDeferPromise(
			getDocumentsAdmin({ status: status !== 'all' ? status : undefined, page, pageSize: RETRIEVAL_PAGE_SIZE }),
			{
				entries: [],
				total: 0,
				totalPages: 1,
			},
		),
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

		const ctx = getAuditContext(event.locals.user, event.getClientAddress());
		await recordAuditEvent({
			...ctx,
			action: 'retrieval.document.delete',
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

		const ctx = getAuditContext(event.locals.user, event.getClientAddress());
		await recordAuditEvent({
			...ctx,
			action: 'retrieval.document.reset',
			targetType: 'document',
			targetId: documentId,
			detail: { title: doc.title },
		});

		return { success: true, message: `Reset "${doc.title}" to pending.` };
	},
};
