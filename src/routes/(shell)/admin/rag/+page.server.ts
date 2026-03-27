import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/guards';
import { recordAuditEvent, getAuditContext } from '$lib/server/admin';
import {
	getRAGOverviewStats,
	getErrorDocuments,
	getDocumentsAdmin,
	getCollectionsAdmin,
} from '$lib/server/db/rag/admin-queries';
import { adminDeleteDocument, adminResetDocument } from '$lib/server/db/rag/admin-mutations';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const status = url.searchParams.get('status') || 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [overview, errorDocs] = await Promise.all([
		getRAGOverviewStats(),
		getErrorDocuments(),
	]);

	return {
		overview,
		errorDocs,
		filters: { status, page },
		documents: safeDeferPromise(
			getDocumentsAdmin({ status: status !== 'all' ? status : undefined, page }),
			{ entries: [], total: 0, totalPages: 1 },
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
