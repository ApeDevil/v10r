/**
 * desk-retrieval-sync — reconcile the deskbot retrieval corpus with each user's ai_context desk
 * files. (Re)ingests files that are new or changed since their last ingest; removes
 * retrieval `source = 'desk'` docs whose origin file is gone or no longer ai_context.
 *
 * Poll-based (compares `desk.file.updatedAt` to the ingested doc's `updatedAt`) so the
 * desk mutation hot-path never pays an embedding round-trip. Returns the number of files
 * (re)ingested this run.
 */
import { deskSourcePath, syncDeskFileToRetrieval } from '$lib/server/ai/deskbot-retrieval';
import { listAiContextFilesForSync } from '$lib/server/db/desk/queries';
import { deleteDocument } from '$lib/server/db/retrieval/mutations';
import { getDocumentBySourcePath, listDeskRetrievalDocs } from '$lib/server/db/retrieval/queries';

export async function deskRetrievalSync(): Promise<number> {
	const files = await listAiContextFilesForSync();
	const livePaths = new Set(files.map((f) => deskSourcePath(f.id)));

	let synced = 0;
	for (const f of files) {
		const doc = await getDocumentBySourcePath(deskSourcePath(f.id), f.userId);
		// (Re)ingest when missing, or stale (file edited after its last ingest).
		if (!doc || doc.updatedAt < f.updatedAt) {
			const ingested = await syncDeskFileToRetrieval(f.userId, f.id, f.type as 'markdown' | 'spreadsheet');
			if (ingested) synced++;
		}
	}

	// Remove orphaned desk docs (origin file deleted or ai_context turned off).
	const deskDocs = await listDeskRetrievalDocs();
	for (const d of deskDocs) {
		if (!d.sourceUri || !livePaths.has(d.sourceUri)) {
			await deleteDocument(d.id, d.userId);
		}
	}

	return synced;
}
