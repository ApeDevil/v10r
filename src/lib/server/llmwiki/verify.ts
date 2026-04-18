/**
 * Post-hoc citation verification.
 *
 * Runs after the LLM finishes its response (`onFinish`). Given the set of
 * rawrag chunkIds the model actually expanded via `get_rawrag_chunks`, we
 * compare their current `chunk.content_hash` to the `source_hash_at_compile`
 * recorded in `llmwiki_page_source`. A match = `paraphrase` (the wiki page
 * citing this chunk is consistent with the current source). A quote-level
 * check requires substring match of the streamed answer against the chunk
 * body — optional, more expensive, and off the default path for v1.
 *
 * Chunks the model did NOT expand remain `verification: 'none'`.
 */

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { chunk as chunkTable, document, llmwikiPageSource } from '$lib/server/db/schema/rag';
import type { LlmwikiCitationVerification } from './types';

export interface VerifyInput {
	userId: string;
	/** Chunk IDs the model surfaced via get_rawrag_chunks during the turn. */
	drilledChunkIds: string[];
	/** The answer text, for optional quote-level checks. */
	answerText?: string;
}

export interface VerifyResult {
	/** Per-chunk verification status. */
	verifications: Map<string, LlmwikiCitationVerification>;
	/** Chunk IDs whose source has drifted (hash mismatch) — candidates for re-compile. */
	driftedChunkIds: string[];
}

export async function verifyCitations(input: VerifyInput): Promise<VerifyResult> {
	const verifications = new Map<string, LlmwikiCitationVerification>();
	const driftedChunkIds: string[] = [];

	if (input.drilledChunkIds.length === 0) return { verifications, driftedChunkIds };

	const rows = await db
		.select({
			chunkId: chunkTable.id,
			content: chunkTable.content,
			currentHash: chunkTable.contentHash,
			recordedHash: llmwikiPageSource.sourceHashAtCompile,
		})
		.from(chunkTable)
		.innerJoin(document, eq(document.id, chunkTable.documentId))
		.leftJoin(llmwikiPageSource, eq(llmwikiPageSource.chunkId, chunkTable.id))
		.where(
			and(inArray(chunkTable.id, input.drilledChunkIds), eq(document.userId, input.userId), isNull(document.deletedAt)),
		);

	// Collapse per chunk. A chunk may be cited by multiple wiki pages — it
	// verifies if ANY source_hash_at_compile matches the current hash.
	// Distinguish three cases:
	//   (a) chunk exists but has no llmwiki_page_source row → 'uncited'
	//   (b) chunk has source rows, none match current hash → 'drifted'
	//   (c) at least one source row matches → 'paraphrase' (or 'quote' if verbatim)
	const perChunk = new Map<string, { hashMatch: boolean; hasCitation: boolean; content: string | null }>();
	for (const r of rows) {
		const existing = perChunk.get(r.chunkId);
		const hasCitation = r.recordedHash !== null;
		const match = hasCitation && r.recordedHash === r.currentHash;
		if (!existing) {
			perChunk.set(r.chunkId, { hashMatch: match, hasCitation, content: r.content });
		} else {
			if (match) existing.hashMatch = true;
			if (hasCitation) existing.hasCitation = true;
		}
	}

	for (const chunkId of input.drilledChunkIds) {
		const entry = perChunk.get(chunkId);
		if (!entry) {
			verifications.set(chunkId, 'uncited');
			continue;
		}

		if (!entry.hasCitation) {
			verifications.set(chunkId, 'uncited');
			continue;
		}

		if (!entry.hashMatch) {
			driftedChunkIds.push(chunkId);
			verifications.set(chunkId, 'drifted');
			continue;
		}

		if (input.answerText && entry.content) {
			const snippet = entry.content.slice(0, 80).trim();
			if (snippet && input.answerText.includes(snippet)) {
				verifications.set(chunkId, 'quote');
				continue;
			}
		}
		verifications.set(chunkId, 'paraphrase');
	}

	return { verifications, driftedChunkIds };
}

/** Utility: mark wiki pages stale when their cited chunks drift (used by lint too). */
export async function markPagesStaleForChunks(chunkIds: string[]): Promise<number> {
	if (chunkIds.length === 0) return 0;
	const res = await db.execute(sql`
		UPDATE rag.llmwiki_page
		SET stale = true, updated_at = now()
		WHERE id IN (
			SELECT DISTINCT llmwiki_page_id
			FROM rag.llmwiki_page_source
			WHERE chunk_id IN (${sql.join(
				chunkIds.map((id) => sql`${id}`),
				sql`, `,
			)})
		)
		  AND stale = false
	`);
	return (res as { rowCount?: number })?.rowCount ?? 0;
}
