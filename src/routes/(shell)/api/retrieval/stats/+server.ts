import { apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { getRAGOverviewStats } from '$lib/server/db/rag/admin-queries';
import { getRagGraphStats } from '$lib/server/graph/rag/queries';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID } from '$lib/server/retrieval/config';
import type { RequestHandler } from './$types';

export interface RetrievalStats {
	corpus: {
		documents: number;
		chunks: number;
		tokens: number;
	};
	tiers: {
		vector: { vectors: number; dimensions: number; indexType: 'hnsw'; model: string };
		parentChild: { parents: number; children: number };
		graph: { nodes: number; edges: number; labels: string[] };
	};
}

export const GET: RequestHandler = async ({ locals }) => {
	requireApiUser(locals);

	const [pgStats, graphStats] = await Promise.all([
		getRAGOverviewStats(),
		getRagGraphStats().catch((err) => {
			console.error('[api:retrieval:stats] Neo4j query failed:', err);
			return { nodes: 0, edges: 0, labels: [] as string[] };
		}),
	]);

	const stats: RetrievalStats = {
		corpus: {
			documents: pgStats.totalDocuments,
			chunks: pgStats.totalChunks,
			tokens: pgStats.totalTokens,
		},
		tiers: {
			vector: {
				vectors: pgStats.totalChunks,
				dimensions: EMBEDDING_DIMENSIONS,
				indexType: 'hnsw',
				model: EMBEDDING_MODEL_ID,
			},
			parentChild: {
				parents: 0,
				children: pgStats.totalChunks,
			},
			graph: graphStats,
		},
	};

	return apiOk(stats);
};
