/**
 * Deskbot retrieval — the deskbot's retrieval PROFILE + ingestion, over the SHARED retrieval
 * kernel. The corpus is the user's OWN desk files (markdown/spreadsheet) opted into AI
 * context — distinct from the chatbot's system-owned docs corpus, but the same engine:
 *   - corpus: the real user's documents (`source = 'desk'`, hard-filtered by `user_id`)
 *   - tiers : 1–2 only (no graph tier — desk files aren't Neo4j-seeded)
 *
 * Freshness is reconciled by the `desk-retrieval-sync` job (polls `updatedAt`), NOT on the
 * mutation hot-path — so editing a sheet doesn't pay an embedding round-trip per save.
 *
 * See `docs/blueprint/ai/surfaces.md` (retrieval: one kernel, two profiles).
 */
import { getMarkdownByFileId, getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import { deleteDocument } from '$lib/server/db/retrieval/mutations';
import { getDocumentBySourcePath } from '$lib/server/db/retrieval/queries';
import { retrieve } from '$lib/server/retrieval';
import { ingest } from '$lib/server/retrieval/ingest';
import type { RetrievalResult } from '$lib/server/retrieval/types';

/** Stable back-pointer from a retrieval document to its originating desk file. */
export const deskSourcePath = (fileId: string) => `desk_file_${fileId}`;

/** Flatten a spreadsheet's sparse cell map into readable `Cell: value` lines. */
function spreadsheetToText(cells: Record<string, { v?: unknown }> | null): string {
	if (!cells) return '';
	return Object.entries(cells)
		.map(([addr, cell]) => `${addr}: ${cell?.v ?? ''}`)
		.join('\n');
}

/**
 * (Re)ingest one desk file into the user's retrieval corpus. Idempotent: deletes any prior
 * retrieval copy (by `sourceUri`) first, then ingests fresh. Returns true if it ingested.
 */
export async function syncDeskFileToRetrieval(
	userId: string,
	fileId: string,
	type: 'markdown' | 'spreadsheet',
): Promise<boolean> {
	let title: string;
	let content: string;
	if (type === 'markdown') {
		const md = await getMarkdownByFileId(fileId, userId);
		if (!md) return false;
		title = md.file.name;
		content = md.markdown.content ?? '';
	} else {
		const sheet = await getSpreadsheetByFileId(fileId, userId);
		if (!sheet) return false;
		title = sheet.file.name;
		content = spreadsheetToText(sheet.spreadsheet.cells as Record<string, { v?: unknown }> | null);
	}

	const sourcePath = deskSourcePath(fileId);
	const existing = await getDocumentBySourcePath(sourcePath, userId);
	if (existing) await deleteDocument(existing.id, userId);

	// Empty file — drop the stale copy (done above) and don't ingest an empty doc.
	if (!content.trim()) return false;

	await ingest({ title, content, sourcePath, sourceType: 'desk', userId });
	return true;
}

/**
 * Production cutoff for `desk_search_knowledge` — exported so the context probe
 * reports (and marks) the real chosen-set boundary instead of a hardcoded copy.
 */
export const DESK_SEARCH_MAX_CHUNKS = 5;

/**
 * The deskbot retrieval profile — semantic search over the user's OWN desk corpus.
 * Tiers 1–2 only; the `user_id` hard-filter in the shared kernel is the tenant boundary.
 */
export async function retrieveDeskDocs(
	userId: string,
	query: string,
	maxChunks = DESK_SEARCH_MAX_CHUNKS,
): Promise<RetrievalResult> {
	return retrieve(query, { userId, tiers: [1, 2], maxChunks });
}
