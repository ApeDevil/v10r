/**
 * get_rawrag_chunks — drill-down into raw source chunks by ID.
 * The model discovers chunk IDs from the `pointers` carried on each
 * llmwiki hit. Use this for quotations, exact wording, fine detail, or
 * when a user challenges a wiki claim.
 *
 * Every call is recorded on the per-turn drill-down set so verify.ts can
 * flag the referenced chunks as verified against current content hashes.
 * Per-turn call cap enforced by the orchestrator (MAX_RAWRAG_TOOL_CALLS_PER_TURN).
 */

import { jsonSchema, tool } from 'ai';
import { MAX_RAWRAG_TOOL_IDS } from '$lib/server/llmwiki/config';
import { fetchChunksByIds } from '$lib/server/rawrag/queries';
import type { DeskToolMeta } from './_types';

export const rawragChunksToolMeta: Record<string, DeskToolMeta> = {
	get_rawrag_chunks: { risk: 'read', scope: 'desk:read' },
};

interface ToolInput {
	ids: string[];
}

export interface DrilledChunkSink {
	record(chunkIds: string[]): void;
}

export function createGetRawragChunksTool(userId: string, sink?: DrilledChunkSink) {
	return {
		get_rawrag_chunks: tool({
			description:
				'Fetch raw source chunks by ID for drill-down. Call this ONLY when the ' +
				'user asks for exact wording, quotations, specific details, or challenges a ' +
				"claim. The ONLY valid `ids` are those listed verbatim under a page's " +
				'`pointers:` section in the <llmwiki-hits> block — for example, if a page ' +
				'lists `chk_seed_rrf | doc_x | "Title" | w=1.00`, pass `ids: ["chk_seed_rrf"]`. ' +
				'NEVER invent, guess, or transform chunk IDs. If no pointer matches the ' +
				"user's need, do not call this tool — say so in your answer instead.",
			inputSchema: jsonSchema<ToolInput>({
				type: 'object',
				properties: {
					ids: {
						type: 'array',
						items: { type: 'string', description: 'Raw chunk id (chk_*) from an llmwiki pointer.' },
						minItems: 1,
						maxItems: MAX_RAWRAG_TOOL_IDS,
						description: 'Chunk ids to expand.',
					},
				},
				required: ['ids'],
			}),
			execute: async ({ ids }) => {
				if (!Array.isArray(ids) || ids.length === 0) {
					return { chunks: [], error: 'ids must be a non-empty array' };
				}
				const bounded = ids.slice(0, MAX_RAWRAG_TOOL_IDS);
				const chunks = await fetchChunksByIds(bounded, userId);
				sink?.record(Array.from(chunks.keys()));
				return {
					chunks: Array.from(chunks.values()),
					missing: bounded.filter((id) => !chunks.has(id)),
				};
			},
		}),
	};
}
