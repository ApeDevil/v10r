/**
 * Deskbot retrieval — the deskbot's retrieval PROFILE + ingestion, over the SHARED retrieval
 * kernel. The corpus is the user's OWN desk files (markdown/spreadsheet) opted into AI
 * context — distinct from the chatbot's system-owned docs corpus, but the same engine:
 *   - corpus: the real user's documents (`source = 'desk'`, hard-filtered by `user_id`)
 *   - tiers : 1–2 only (no graph tier — desk files aren't Neo4j-seeded)
 *
 * Freshness is reconciled by the `desk-retrieval-sync` job (polls `updatedAt`), NOT on the
 * save hot-path — so editing a sheet doesn't pay an embedding round-trip per save. Pinning a
 * file ingests it right after the response; unpinning or deleting removes its copy at once
 * (no embedding). Content edits reach the index at the next daily sync, and every hit says
 * when its copy was indexed and whether the file has changed since, so the bot can read the
 * live file instead when it matters.
 *
 * See `docs/blueprint/ai/surfaces.md` (retrieval: one kernel, two profiles).
 */
import type { SpreadsheetCells } from '$lib/desk/spreadsheet-cells';
import { getMarkdownByFileId, getSpreadsheetByFileId, listFileTimestamps } from '$lib/server/db/desk/queries';
import { deleteDocument } from '$lib/server/db/retrieval/mutations';
import { getDocumentBySourcePath, listDocumentOrigins } from '$lib/server/db/retrieval/queries';
import { deferAfterResponse } from '$lib/server/platform';
import { retrieve } from '$lib/server/retrieval';
import { ingest } from '$lib/server/retrieval/ingest';
import type { RankedChunk, RetrievalResult } from '$lib/server/retrieval/types';

/** Stable back-pointer from a retrieval document to its originating desk file. */
export const deskSourcePath = (fileId: string) => `desk_file_${fileId}`;

/** The desk file behind a retrieval document's `sourceUri`, or null for another source. */
export const deskFileIdOf = (sourceUri: string | null) =>
	sourceUri?.startsWith('desk_file_') ? sourceUri.slice('desk_file_'.length) : null;

/** Flatten a spreadsheet's sparse cell map into readable `Cell: value` lines. */
function spreadsheetToText(cells: SpreadsheetCells): string {
	return Object.entries(cells)
		.map(([addr, cell]) => `${addr}: ${cell.v ?? ''}`)
		.join('\n');
}

/**
 * (Re)ingest one desk file into the user's retrieval corpus. Idempotent by `sourceUri`: the
 * fresh copy is ingested FIRST and the previous one removed only once that succeeded, so a
 * failed re-ingest (embedding quota, a transient error) leaves the old copy searchable
 * instead of a gap until the next sync. Returns true if it ingested.
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
		content = spreadsheetToText(sheet.spreadsheet.cells);
	}

	const sourcePath = deskSourcePath(fileId);
	const existing = await getDocumentBySourcePath(sourcePath, userId);

	// Empty file — nothing to index; drop any stale copy.
	if (!content.trim()) {
		if (existing) await deleteDocument(existing.id, userId);
		return false;
	}

	await ingest({ title, content, sourcePath, sourceType: 'desk', userId });
	if (existing) await deleteDocument(existing.id, userId);
	return true;
}

/** Remove a desk file's retrieval copy — on unpin and on delete. No embedding involved. */
export async function removeDeskFileFromRetrieval(userId: string, fileId: string): Promise<boolean> {
	const existing = await getDocumentBySourcePath(deskSourcePath(fileId), userId);
	if (!existing) return false;
	return deleteDocument(existing.id, userId);
}

/**
 * The index follows the pin, off the response: pinning ingests, unpinning removes. Edits to a
 * pinned file wait for the daily `desk-retrieval-sync` — the one embedding cost that stays off
 * the interactive path by decision.
 */
export function followAiContextChange(
	userId: string,
	fileId: string,
	type: 'markdown' | 'spreadsheet',
	pinned: boolean,
) {
	deferAfterResponse(pinned ? 'desk-retrieval:pin' : 'desk-retrieval:unpin', () =>
		pinned ? syncDeskFileToRetrieval(userId, fileId, type) : removeDeskFileFromRetrieval(userId, fileId),
	);
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
	// `source: 'desk'` is the corpus boundary: the same user's web uploads or pasted text are
	// theirs too, but they are not the desk the bot was asked about.
	return retrieve(query, { userId, tiers: [1, 2], maxChunks, source: 'desk' });
}

/** A retrieved chunk with the desk file it came from and how fresh that copy is. */
export interface DeskKnowledgeHit {
	fileId: string | null;
	documentTitle: string;
	content: string;
	score: number;
	/** When the retrieval copy was indexed. */
	indexedAt: string | null;
	/** The live file changed after its copy was indexed — read the file for the current text. */
	stale: boolean;
}

/**
 * Attribute retrieved chunks to their desk files and mark the ones whose file has moved on
 * since it was indexed — two queries over the (≤ maxChunks) hits, never per chunk.
 */
export async function attributeDeskHits(userId: string, chunks: readonly RankedChunk[]): Promise<DeskKnowledgeHit[]> {
	const origins = await listDocumentOrigins([...new Set(chunks.map((c) => c.documentId))], userId);
	const byDocument = new Map(origins.map((o) => [o.id, { fileId: deskFileIdOf(o.sourceUri), indexedAt: o.updatedAt }]));
	const fileIds = [...new Set([...byDocument.values()].map((o) => o.fileId).filter((id): id is string => !!id))];
	const files = new Map((await listFileTimestamps(userId, fileIds)).map((f) => [f.id, f.updatedAt]));
	return chunks.map((c) => {
		const origin = byDocument.get(c.documentId);
		const liveAt = origin?.fileId ? files.get(origin.fileId) : undefined;
		return {
			fileId: origin?.fileId ?? null,
			documentTitle: c.documentTitle,
			content: c.content,
			score: Math.round(c.score * 1000) / 1000,
			indexedAt: origin?.indexedAt.toISOString() ?? null,
			stale: !!(origin && liveAt && liveAt > origin.indexedAt),
		};
	});
}
