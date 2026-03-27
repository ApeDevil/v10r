import { cypher } from '$lib/server/graph';
import {
	type Neo4jMetrics,
	type ProviderResult,
	FREE_TIER_LIMITS,
	computePercentage,
	computeThreshold,
	sanitizeError,
} from './index';

export async function fetchNeo4jMetrics(): Promise<ProviderResult<Neo4jMetrics>> {
	const start = performance.now();

	try {
		let nodeCount: number;
		let relCount: number;
		let labels: Array<{ label: string; count: number }>;
		let relTypes: Array<{ type: string; count: number }>;

		try {
			const [stats] = await cypher<{
				nodeCount: number;
				relCount: number;
				labels: Record<string, number>;
				relTypesCount: Record<string, number>;
			}>('CALL apoc.meta.stats() YIELD nodeCount, relCount, labels, relTypesCount');

			nodeCount = Number(stats.nodeCount);
			relCount = Number(stats.relCount);
			labels = Object.entries(stats.labels).map(([label, count]) => ({
				label,
				count: Number(count),
			}));
			relTypes = Object.entries(stats.relTypesCount).map(([type, count]) => ({
				type,
				count: Number(count),
			}));
		} catch {
			const [nodeResult, relResult, labelResult, relTypeResult] = await Promise.all([
				cypher<{ count: number }>('MATCH (n) RETURN count(n) AS count'),
				cypher<{ count: number }>('MATCH ()-[r]->() RETURN count(r) AS count'),
				cypher<{ label: string }>('CALL db.labels() YIELD label RETURN label'),
				cypher<{ relationshipType: string }>(
					'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType',
				),
			]);

			nodeCount = Number(nodeResult[0]?.count ?? 0);
			relCount = Number(relResult[0]?.count ?? 0);
			labels = labelResult.map((r) => ({ label: r.label, count: 0 }));
			relTypes = relTypeResult.map((r) => ({ type: r.relationshipType, count: 0 }));
		}

		const latencyMs = Math.round((performance.now() - start) * 100) / 100;
		const { nodes: nodeLimit, relationships: relLimit } = FREE_TIER_LIMITS.neo4j;

		return {
			status: 'ok',
			data: {
				nodeCount,
				relCount,
				nodeLimit,
				relLimit,
				nodePercentage: computePercentage(nodeCount, nodeLimit),
				relPercentage: computePercentage(relCount, relLimit),
				nodeThreshold: computeThreshold(nodeCount, nodeLimit),
				relThreshold: computeThreshold(relCount, relLimit),
				labels,
				relTypes,
			},
			error: null,
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			status: 'unavailable',
			data: null,
			error: sanitizeError(err),
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	}
}
