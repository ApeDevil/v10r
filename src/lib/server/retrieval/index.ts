import type { RetrievalStepEvent, StepDetail } from '$lib/types/retrieval-trace';
import { escapeXmlText } from '$lib/utils/xml';
import { EMBEDDING_DIMENSIONS, MAX_CONTEXT_CHUNKS, MAX_GRAPH_HOPS } from './config';

// The query embedding is the engine's own door for its consumers (the chatbot profile's
// shared per-turn vector), so no consumer reaches into `embed.ts` by file.
export { generateEmbedding } from './embed';
export type { RankedChunk, RetrievalResult } from './types';

import { generateEmbedding } from './embed';
import { fuseAndRank } from './rank';
import { searchContextual } from './tiers/contextual';
import { getGraphEntities, searchGraph } from './tiers/graph';
import { searchParentChild } from './tiers/parent-child';
import type { RankedChunk, RetrievalOptions, RetrievalResult } from './types';

const DEFAULT_OPTIONS: Required<
	Omit<RetrievalOptions, 'source' | 'userId' | 'queryEmbedding' | 'embeddingConnection'>
> = {
	maxChunks: MAX_CONTEXT_CHUNKS,
	tiers: [1],
	graphDepth: MAX_GRAPH_HOPS,
};

type EmitFn = (event: RetrievalStepEvent) => void;

function emit(
	fn: EmitFn,
	step: RetrievalStepEvent['step'],
	status: RetrievalStepEvent['status'],
	extra?: { durationMs?: number; error?: string; detail?: StepDetail },
) {
	fn({ type: 'pipeline:step', step, status, ...extra });
}

/**
 * Retrieve relevant chunks for a query.
 * Single entry point for all retrieval tiers.
 *
 * When `onEvent` is provided, emits pipeline events at each step
 * for real-time UI feedback. When absent, runs the same flow silently.
 */
export async function retrieve(query: string, options: RetrievalOptions, onEvent?: EmitFn): Promise<RetrievalResult> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const start = performance.now();
	const requestedTiers = new Set(opts.tiers);

	// Reuse a caller-supplied vector when present (lets a chatbot turn embed the user
	// message ONCE and share it across every lane and tool that retrieves). The
	// 'done' event still fires — marked `reused` — so the pipeline trace stays intact.
	const embedStart = performance.now();
	onEvent && emit(onEvent, 'embed', 'active');
	const reusedEmbedding = !!opts.queryEmbedding;
	let queryEmbedding: number[];
	try {
		queryEmbedding = opts.queryEmbedding ?? (await generateEmbedding(query, { connection: opts.embeddingConnection }));
		onEvent &&
			emit(onEvent, 'embed', 'done', {
				durationMs: Math.round(performance.now() - embedStart),
				detail: { kind: 'embed', dimensions: EMBEDDING_DIMENSIONS, query, reused: reusedEmbedding },
			});
	} catch (err) {
		onEvent &&
			emit(onEvent, 'embed', 'error', {
				durationMs: Math.round(performance.now() - embedStart),
				error: err instanceof Error ? err.message : 'Embedding failed',
			});
		throw err;
	}

	// Run requested tiers in parallel
	const tierPromises = opts.tiers.map(async (tier) => {
		const stepId = `tier-${tier}` as const;
		const tierStart = performance.now();
		onEvent && emit(onEvent, stepId, 'active');

		try {
			let chunks: RankedChunk[];
			switch (tier) {
				case 1:
					chunks = await searchContextual(query, queryEmbedding, opts.maxChunks, opts.userId, opts.source);
					break;
				case 2:
					chunks = await searchParentChild(queryEmbedding, opts.maxChunks, opts.userId, opts.source);
					break;
				case 3:
					chunks = await searchGraph(queryEmbedding, opts.maxChunks, opts.graphDepth, opts.userId);
					break;
			}

			onEvent &&
				emit(onEvent, stepId, 'done', {
					durationMs: Math.round(performance.now() - tierStart),
					detail: {
						kind: 'tier',
						tierNumber: tier,
						chunksFound: chunks.length,
						topSources: chunks
							.slice(0, 3)
							.map((c) => ({ title: c.documentTitle, score: Math.round(c.score * 1000) / 1000 })),
					},
				});

			return chunks;
		} catch (err) {
			onEvent &&
				emit(onEvent, stepId, 'error', {
					durationMs: Math.round(performance.now() - tierStart),
					error: err instanceof Error ? err.message : `Tier ${tier} failed`,
				});
			return [] as RankedChunk[];
		}
	});

	const tierResults = await Promise.all(tierPromises);

	const rankStart = performance.now();
	onEvent && emit(onEvent, 'rank', 'active');
	const allChunks = tierResults.flat();
	const { chunks } = fuseAndRank(allChunks, opts.maxChunks);

	// Entities only populated when tier 3 (graph) ran AND graph chunks actually survived
	// fusion. Without this guard a serial Neo4j round-trip fired on every tier-3 request even
	// when the graph contributed nothing — a blocking call on the response path for zero payoff.
	//
	// Provenance is read from the PRE-fusion lists, not from the surviving chunk's own `tier`.
	// A chunk found by both tier 1 and tier 3 collapses to a single object during fusion, so
	// whichever copy won would otherwise decide this round-trip.
	const graphChunkIds = new Set(allChunks.filter((c) => c.tier === 3).map((c) => c.chunkId));
	const entities =
		requestedTiers.has(3) && chunks.some((c) => graphChunkIds.has(c.chunkId))
			? await getGraphEntities(
					chunks.map((c) => c.chunkId),
					[opts.userId],
				)
			: [];
	onEvent &&
		emit(onEvent, 'rank', 'done', {
			durationMs: Math.round(performance.now() - rankStart),
			detail: {
				kind: 'rank',
				inputChunks: allChunks.length,
				outputChunks: chunks.length,
				method: opts.tiers.length > 1 ? 'rrf' : 'single',
			},
		});

	const ctxStart = performance.now();
	onEvent && emit(onEvent, 'context', 'active');
	const tokenEstimate = chunks.reduce((sum, c) => sum + Math.ceil(c.content.length / 4), 0);
	onEvent &&
		emit(onEvent, 'context', 'done', {
			durationMs: Math.round(performance.now() - ctxStart),
			detail: {
				kind: 'context',
				tokenEstimate,
				chunkCount: chunks.length,
			},
		});

	return {
		chunks,
		entities,
		tierUsed: opts.tiers,
		durationMs: Math.round(performance.now() - start),
	};
}

/** Redact credential patterns before injecting into LLM context. */
const CREDENTIAL_RE = /(?:sk-|ghp_|gho_|glpat-|AKIA|Bearer\s)\S+/gi;

/** Max characters for retrieval context injection (~4K tokens). */
const MAX_CONTEXT_CHARS = 16_000;

/**
 * Format retrieved chunks for injection into an LLM system prompt.
 *
 * Content is XML-escaped, because the caller wraps this in a tagged block and
 * the chunks are NOT ours. `/api/retrieval/ingest` accepts up to 200 000
 * characters of arbitrary text per document, so an ingested file containing
 * `</retrieval-context>` would close the block early and everything after it
 * would read as prompt rather than as data — to a model that is about to answer
 * on the strength of it.
 *
 * `<desk-context>` has escaped for exactly this reason for a while; this block
 * carries the same class of content and did not.
 *
 * Escaping stops the delimiter breakout. It does NOT stop instructions embedded
 * in prose — that is what the "data, not instructions" framing in the system
 * prompt is for, and neither measure substitutes for the other.
 */
export function formatContextForPrompt(result: RetrievalResult, maxChars = MAX_CONTEXT_CHARS): string {
	return formatContextChunks(result.chunks.slice(0, contextChunkCut(result, maxChars)));
}

/**
 * How many of the result's chunks, in rank order, fit the prompt's size cap — the index at
 * which `formatContextForPrompt` stops. Equal to `chunks.length` when nothing is cut; the
 * turn trace records the cut so a dropped chunk shows as considered, not included.
 */
export function contextChunkCut(result: RetrievalResult, maxChars = MAX_CONTEXT_CHARS): number {
	let totalLen = 0;
	for (let i = 0; i < result.chunks.length; i++) {
		totalLen += formatContextChunk(result.chunks[i], i).length;
		if (totalLen > maxChars) return i;
	}
	return result.chunks.length;
}

function formatContextChunk(c: RetrievalResult['chunks'][number], index: number): string {
	return `[${index + 1}] ${escapeXmlText(c.documentTitle)}\n${escapeXmlText(c.content)}`;
}

function formatContextChunks(chunks: RetrievalResult['chunks']): string {
	if (chunks.length === 0) return '';
	return chunks.map(formatContextChunk).join('\n\n---\n\n').replace(CREDENTIAL_RE, '[REDACTED]');
}
