/**
 * desk-retrieval-sync — reconcile the deskbot retrieval corpus with each user's ai_context desk
 * files. (Re)ingests files that are new or changed since their last ingest; removes
 * retrieval `source = 'desk'` docs whose origin file is gone or no longer ai_context.
 *
 * Every pinned file is offered to `syncDeskFileToRetrieval`, whose derivation key decides:
 * a file whose content, title, chunker, embedding model and context model are unchanged
 * costs a read and no embedding, while a chunker or model bump re-derives every copy — which
 * an `updatedAt` comparison alone never would. The desk mutation hot-path still never pays an
 * embedding round-trip. Returns the number of files (re)ingested this run.
 */
import { deskSourcePath, syncDeskFileToRetrieval } from '#lib/server/ai/deskbot-retrieval.ts';
import { listAiContextFilesForSync } from '#lib/server/db/desk/queries.ts';
import { deleteDocument } from '#lib/server/db/retrieval/mutations.ts';
import { listDeskRetrievalDocs } from '#lib/server/db/retrieval/queries.ts';

export async function deskRetrievalSync(): Promise<number> {
	const files = await listAiContextFilesForSync();
	const livePaths = new Set(files.map((f) => deskSourcePath(f.id)));

	let synced = 0;
	for (const f of files) {
		const ingested = await syncDeskFileToRetrieval(f.userId, f.id, f.type as 'markdown' | 'spreadsheet');
		if (ingested) synced++;
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
