import {
	type ChunkSummary,
	PHASE_OF,
	RETRIEVER_OF,
	type RetrievalChunksEvent,
	type RetrievalPromptEvent,
	type RetrievalStepEvent,
	type RetrieverId,
	type StepDetail,
} from '$lib/types/retrieval-trace';
import { escapeXmlText } from '$lib/utils/xml';
import { EMBEDDING_DIMENSIONS, MAX_CONTEXT_CHUNKS, MAX_GRAPH_HOPS } from './config';

export { OVERFETCH_MULTIPLIER, RRF_K } from './config';

import { generateEmbedding } from './embed';
import { fuseAndRank } from './rank';
import { searchContextual } from './tiers/contextual';
import { getGraphEntities, searchGraph } from './tiers/graph';
import { searchParentChild } from './tiers/parent-child';
import type { RankedChunk, RetrievalOptions, RetrievalResult } from './types';

const DEFAULT_OPTIONS: Required<Omit<RetrievalOptions, 'collectionId' | 'userId' | 'queryEmbedding'>> = {
	maxChunks: MAX_CONTEXT_CHUNKS,
	tiers: [1],
	graphDepth: MAX_GRAPH_HOPS,
	fusion: 'rrf',
};

type EmitFn = (event: RetrievalStepEvent | RetrievalChunksEvent | RetrievalPromptEvent) => void;

function toSummary(
	chunk: RankedChunk,
	survived: boolean,
	extras?: { rrfRank?: number; rrfContribution?: number; dispositionReason?: ChunkSummary['dispositionReason'] },
): ChunkSummary {
	const retrieverScores: ChunkSummary['retrieverScores'] = {};
	if (chunk.source === 'vector' || chunk.source === 'bm25') retrieverScores[chunk.source] = chunk.score;
	else if (chunk.tier === 2) retrieverScores.parentChild = chunk.score;
	else if (chunk.tier === 3 || chunk.source === 'graph') retrieverScores.graph = chunk.score;

	return {
		chunkId: chunk.chunkId,
		documentId: chunk.documentId,
		documentTitle: chunk.documentTitle,
		contentPreview: chunk.content.slice(0, 200),
		contentLength: chunk.content.length,
		score: Math.round(chunk.score * 1000) / 1000,
		source: chunk.source,
		tier: chunk.tier,
		survived,
		retrieverScores,
		rrfRank: extras?.rrfRank,
		rrfContribution: extras?.rrfContribution,
		dispositionReason: extras?.dispositionReason,
	};
}

function emit(
	fn: EmitFn,
	step: RetrievalStepEvent['step'],
	status: RetrievalStepEvent['status'],
	extra?: { startOffsetMs?: number; durationMs?: number; error?: string; detail?: StepDetail },
) {
	fn({
		type: 'pipeline:step',
		step,
		phase: PHASE_OF[step],
		instanceKey: step,
		retriever: RETRIEVER_OF[step],
		status,
		...extra,
	});
}

/**
 * Retrieve relevant chunks for a query.
 * Single entry point for all retrieval tiers.
 *
 * When `onEvent` is provided, emits pipeline events at each step
 * for real-time UI feedback. When absent, runs the same flow silently.
 */
export async function retrieve(
	query: string,
	options: RetrievalOptions,
	onEvent?: EmitFn,
	/** Turn t0 (orchestrator-owned). Step offsets are measured against it so the
	 *  whole turn — retrieve + generate — shares one origin. Defaults to retrieval start. */
	t0?: number,
): Promise<RetrievalResult> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const start = performance.now();
	const emitOrigin = t0 ?? start;
	const requestedTiers = new Set(opts.tiers);

	// Reuse a caller-supplied vector when present (lets a chatbot turn embed the user
	// message ONCE and share it with both this retrieve and the llmwiki search). The
	// 'done' event still fires — marked `reused` — so the pipeline trace stays intact.
	const embedStart = performance.now();
	onEvent && emit(onEvent, 'embed', 'active', { startOffsetMs: Math.round(embedStart - emitOrigin) });
	const reusedEmbedding = !!opts.queryEmbedding;
	let queryEmbedding: number[];
	try {
		queryEmbedding = opts.queryEmbedding ?? (await generateEmbedding(query));
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

	// Skip events for unused tiers
	if (onEvent) {
		for (const t of [1, 2, 3] as const) {
			if (!requestedTiers.has(t)) {
				emit(onEvent, `tier-${t}`, 'skipped');
			}
		}
	}

	// Run requested tiers in parallel
	const tierPromises = opts.tiers.map(async (tier) => {
		const stepId = `tier-${tier}` as const;
		const tierStart = performance.now();
		onEvent && emit(onEvent, stepId, 'active', { startOffsetMs: Math.round(tierStart - emitOrigin) });

		try {
			let chunks: RankedChunk[];
			switch (tier) {
				case 1:
					chunks = await searchContextual(query, queryEmbedding, opts.maxChunks, opts.userId);
					break;
				case 2:
					chunks = await searchParentChild(queryEmbedding, opts.maxChunks, opts.userId);
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
	onEvent && emit(onEvent, 'rank', 'active', { startOffsetMs: Math.round(rankStart - emitOrigin) });
	const allChunks = tierResults.flat();
	const { chunks } = fuseAndRank(allChunks, opts.maxChunks);

	// Entities only populated when tier 3 (graph) ran AND graph chunks actually survived
	// fusion. Without the `chunks.some(...)` guard this fired a serial Neo4j round-trip on
	// every tier-3 request even when the graph contributed nothing — a blocking call on the
	// response path for zero payoff.
	const entities =
		requestedTiers.has(3) && chunks.some((c) => c.tier === 3 || c.source === 'graph')
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
	onEvent && emit(onEvent, 'context', 'active', { startOffsetMs: Math.round(ctxStart - emitOrigin) });
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

	if (onEvent) {
		const survivedIds = new Set(chunks.map((c) => c.chunkId));
		const rrfRankById = new Map<string, number>();
		for (let idx = 0; idx < chunks.length; idx++) {
			rrfRankById.set(chunks[idx].chunkId, idx + 1);
		}
		const multiTier = opts.tiers.length > 1;
		const defaultReason: ChunkSummary['dispositionReason'] = multiTier ? 'rrf_threshold' : 'top_k';
		const dropReason: ChunkSummary['dispositionReason'] = multiTier ? 'rrf_cutoff' : 'below_top_k';

		const tierChunks: Partial<Record<RetrieverId, ChunkSummary[]>> = {};
		for (let i = 0; i < opts.tiers.length; i++) {
			const tier = opts.tiers[i];
			const tierResult = tierResults[i];
			tierChunks[`tier-${tier}` as RetrieverId] = tierResult.map((c) =>
				toSummary(c, survivedIds.has(c.chunkId), {
					rrfRank: rrfRankById.get(c.chunkId),
					rrfContribution: survivedIds.has(c.chunkId) ? c.score : undefined,
					dispositionReason: survivedIds.has(c.chunkId) ? defaultReason : dropReason,
				}),
			);
		}
		onEvent({
			type: 'pipeline:chunks',
			tierChunks,
			rankedChunks: allChunks
				.filter((c) => survivedIds.has(c.chunkId))
				.sort((a, b) => b.score - a.score)
				.map((c) =>
					toSummary(c, true, {
						rrfRank: rrfRankById.get(c.chunkId),
						rrfContribution: c.score,
						dispositionReason: defaultReason,
					}),
				),
			contextChunks: chunks.map((c) =>
				toSummary(c, true, {
					rrfRank: rrfRankById.get(c.chunkId),
					rrfContribution: c.score,
					dispositionReason: defaultReason,
				}),
			),
		});
	}

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
	if (result.chunks.length === 0) return '';

	const parts: string[] = [];
	let totalLen = 0;

	for (let i = 0; i < result.chunks.length; i++) {
		const c = result.chunks[i];
		const part = `[${i + 1}] ${escapeXmlText(c.documentTitle)}\n${escapeXmlText(c.content)}`;
		if (totalLen + part.length > maxChars) break;
		parts.push(part);
		totalLen += part.length;
	}

	return parts.join('\n\n---\n\n').replace(CREDENTIAL_RE, '[REDACTED]');
}
