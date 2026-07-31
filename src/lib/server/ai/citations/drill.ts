/**
 * Shape drilled rawrag chunks into the client-facing `SourceChunk[]` that the
 * chatbot streams on `metadata.sourceChunks`.
 *
 * Pure composition over existing owner-scoped helpers — no new domain logic:
 *   - `fetchChunksByIds` already filters by owner + `deleted_at IS NULL` +
 *     `status='ready'`, so deleted / foreign chunks are simply skipped.
 *   - the verdict comes from `verifyCitations`' per-chunk map.
 *
 * Content is redacted before it leaves the server (first time chunk bodies cross
 * to the client). Render side treats it as plain text.
 */

import type { LlmwikiCitationVerification } from '$lib/server/llmwiki';
import { fetchChunksByIds } from '$lib/server/rawrag/queries';
import type { ChunkVerdict, SourceChunk } from '$lib/types/citation';

/** Same pattern used before prompt injection in context/system-prompt.ts. */
function redactSecrets(text: string): string {
	return text.replace(/(?:sk-|ghp_|AKIA|Bearer\s)\S+/gi, '[REDACTED]');
}

/** A drilled chunk only ever resolves to one of these four verdicts. */
function toVerdict(v: LlmwikiCitationVerification | undefined): ChunkVerdict {
	return v === 'quote' || v === 'paraphrase' || v === 'drifted' ? v : 'uncited';
}

export async function shapeDrilledCitations(
	userId: string,
	drilledChunkIds: string[],
	verifications: Map<string, LlmwikiCitationVerification>,
): Promise<SourceChunk[]> {
	if (drilledChunkIds.length === 0) return [];

	const rows = await fetchChunksByIds(drilledChunkIds, userId);
	const out: SourceChunk[] = [];
	for (const id of drilledChunkIds) {
		const row = rows.get(id);
		if (!row) continue; // deleted / not-owned — drop, never leak
		out.push({
			chunkId: row.chunkId,
			documentId: row.documentId,
			documentTitle: row.documentTitle,
			content: redactSecrets(row.content),
			layer: 'rawrag',
			level: row.level,
			verdict: toVerdict(verifications.get(id)),
		});
	}
	return out;
}
