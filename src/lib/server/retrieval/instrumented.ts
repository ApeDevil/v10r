import type { RetrievalResult, RetrievalOptions, RankedChunk } from './types';
import type { PipelineStepEvent, StepDetail } from '$lib/types/pipeline';
import { generateEmbedding } from './embed';
import { searchContextual } from './tiers/contextual';
import { searchParentChild } from './tiers/parent-child';
import { searchGraph } from './tiers/graph';
import { fuseAndRank } from './rank';
import { MAX_CONTEXT_CHUNKS, MAX_GRAPH_HOPS, EMBEDDING_DIMENSIONS } from './config';

const DEFAULT_OPTIONS: Required<Omit<RetrievalOptions, 'collectionId' | 'userId'>> = {
	maxChunks: MAX_CONTEXT_CHUNKS,
	tiers: [1],
	graphDepth: MAX_GRAPH_HOPS,
};

type EmitFn = (event: PipelineStepEvent) => void;

function emit(fn: EmitFn, step: PipelineStepEvent['step'], status: PipelineStepEvent['status'], extra?: { durationMs?: number; error?: string; detail?: StepDetail }) {
	fn({ type: 'pipeline:step', step, status, ...extra });
}

/**
 * Retrieve with pipeline event emission.
 * Mirrors retrieve() flow but emits PipelineStepEvent at each transition.
 * Original retrieve() stays untouched.
 */
export async function retrieveWithEvents(
	query: string,
	options: RetrievalOptions,
	onEvent: EmitFn,
): Promise<RetrievalResult> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const start = performance.now();
	const requestedTiers = new Set(opts.tiers);

	// --- Embed ---
	emit(onEvent, 'embed', 'active');
	const embedStart = performance.now();
	let queryEmbedding: number[];
	try {
		queryEmbedding = await generateEmbedding(query);
		emit(onEvent, 'embed', 'done', {
			durationMs: Math.round(performance.now() - embedStart),
			detail: { kind: 'embed', dimensions: EMBEDDING_DIMENSIONS },
		});
	} catch (err) {
		emit(onEvent, 'embed', 'error', {
			durationMs: Math.round(performance.now() - embedStart),
			error: err instanceof Error ? err.message : 'Embedding failed',
		});
		throw err;
	}

	// --- Skip events for unused tiers ---
	for (const t of [1, 2, 3] as const) {
		if (!requestedTiers.has(t)) {
			emit(onEvent, `tier-${t}`, 'skipped');
		}
	}

	// --- Run requested tiers in parallel ---
	const tierPromises = opts.tiers.map(async (tier) => {
		const stepId = `tier-${tier}` as const;
		emit(onEvent, stepId, 'active');
		const tierStart = performance.now();

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

			emit(onEvent, stepId, 'done', {
				durationMs: Math.round(performance.now() - tierStart),
				detail: {
					kind: 'tier',
					tierNumber: tier,
					chunksFound: chunks.length,
					topSources: chunks.slice(0, 3).map((c) => ({ title: c.documentTitle, score: Math.round(c.score * 1000) / 1000 })),
				},
			});

			return chunks;
		} catch (err) {
			emit(onEvent, stepId, 'error', {
				durationMs: Math.round(performance.now() - tierStart),
				error: err instanceof Error ? err.message : `Tier ${tier} failed`,
			});
			return [] as RankedChunk[];
		}
	});

	const tierResults = await Promise.all(tierPromises);

	// --- Rank ---
	emit(onEvent, 'rank', 'active');
	const rankStart = performance.now();
	const allChunks = tierResults.flat();
	const { chunks, entities } = fuseAndRank(allChunks, opts.maxChunks);
	emit(onEvent, 'rank', 'done', {
		durationMs: Math.round(performance.now() - rankStart),
		detail: {
			kind: 'rank',
			inputChunks: allChunks.length,
			outputChunks: chunks.length,
			method: opts.tiers.length > 1 ? 'rrf' : 'single',
		},
	});

	// --- Context assembly ---
	emit(onEvent, 'context', 'active');
	const ctxStart = performance.now();
	const tokenEstimate = chunks.reduce((sum, c) => sum + Math.ceil(c.content.length / 4), 0);
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
