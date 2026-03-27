import type { KnowledgeData } from '$lib/types/knowledge';
import { cypher } from '../index';
import type { Neo4jNodeRecord, Neo4jRelRecord } from '../types';
import { toKnowledgeData } from '../types';

// ─── Connection page ────────────────────────────────────

interface ConnectionInfo {
	connected: boolean;
	neo4jVersion: string | null;
	edition: string | null;
	nodeCount: number;
	relCount: number;
	labelCount: number;
	relTypeCount: number;
}

export async function verifyConnection(): Promise<ConnectionInfo> {
	const [components, nodeCounts, relCounts, labels, relTypes] = await Promise.all([
		cypher<{ name: string; versions: string[]; edition: string }>(
			`CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition`,
		),
		cypher<{ count: number }>('MATCH (n) RETURN count(n) AS count'),
		cypher<{ count: number }>('MATCH ()-[r]->() RETURN count(r) AS count'),
		cypher<{ label: string }>('CALL db.labels() YIELD label RETURN label'),
		cypher<{ relationshipType: string }>('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType'),
	]);

	const comp = components[0];

	return {
		connected: true,
		neo4jVersion: comp?.versions?.[0] ?? null,
		edition: comp?.edition ?? null,
		nodeCount: Number(nodeCounts[0]?.count ?? 0),
		relCount: Number(relCounts[0]?.count ?? 0),
		labelCount: labels.length,
		relTypeCount: relTypes.length,
	};
}

// ─── Model page ─────────────────────────────────────────

interface LabelInfo {
	label: string;
	count: number;
	sampleProperties: string[];
}

export async function getLabelsWithCounts(): Promise<LabelInfo[]> {
	const labels = await cypher<{ label: string }>('CALL db.labels() YIELD label RETURN label');

	const results: LabelInfo[] = [];
	for (const { label } of labels) {
		const [countResult] = await cypher<{ count: number }>(`MATCH (n:\`${label}\`) RETURN count(n) AS count`);
		const sampleResult = await cypher<{ keys: string[] }>(
			`MATCH (n:\`${label}\`) WITH n LIMIT 1 RETURN keys(n) AS keys`,
		);
		results.push({
			label,
			count: Number(countResult?.count ?? 0),
			sampleProperties: sampleResult[0]?.keys ?? [],
		});
	}

	return results;
}

interface RelTypeInfo {
	type: string;
	count: number;
	startLabel: string;
	endLabel: string;
}

export async function getRelTypesWithCounts(): Promise<RelTypeInfo[]> {
	const types = await cypher<{ relationshipType: string }>(
		'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType',
	);

	const results: RelTypeInfo[] = [];
	for (const { relationshipType } of types) {
		const [countResult] = await cypher<{ count: number }>(
			`MATCH ()-[r:\`${relationshipType}\`]->() RETURN count(r) AS count`,
		);
		const [sample] = await cypher<{ startLabel: string; endLabel: string }>(
			`MATCH (a)-[r:\`${relationshipType}\`]->(b)
			 RETURN labels(a)[0] AS startLabel, labels(b)[0] AS endLabel
			 LIMIT 1`,
		);
		results.push({
			type: relationshipType,
			count: Number(countResult?.count ?? 0),
			startLabel: sample?.startLabel ?? '?',
			endLabel: sample?.endLabel ?? '?',
		});
	}

	return results;
}

export async function getFullGraph(): Promise<KnowledgeData> {
	const [nodeRows, relRows] = await Promise.all([
		cypher<{ n: Neo4jNodeRecord }>('MATCH (n) RETURN n'),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (a)-[r]->(b)
			 RETURN r, elementId(a) AS startId, elementId(b) AS endId`,
		),
	]);

	const nodes: Neo4jNodeRecord[] = nodeRows.map((row) => row.n);
	const relationships: Neo4jRelRecord[] = relRows.map((row) => ({
		...row.r,
		startNodeElementId: row.startId,
		endNodeElementId: row.endId,
	}));

	return toKnowledgeData(nodes, relationships);
}

// ─── Traversal page ─────────────────────────────────────

interface NodeSummary {
	elementId: string;
	label: string;
	name: string;
}

export async function getAllNodes(): Promise<NodeSummary[]> {
	return cypher<NodeSummary>(
		`MATCH (n)
		 RETURN elementId(n) AS elementId, labels(n)[0] AS label, n.name AS name
		 ORDER BY labels(n)[0], n.name`,
	);
}

interface NodeWithConnections {
	elementId: string;
	labels: string[];
	properties: Record<string, unknown>;
	connections: Array<{
		direction: 'IN' | 'OUT';
		relType: string;
		neighborId: string;
		neighborName: string;
		neighborLabel: string;
	}>;
}

export async function getNodeWithConnections(elementId: string): Promise<NodeWithConnections | null> {
	const [nodeRow] = await cypher<{ n: Neo4jNodeRecord }>('MATCH (n) WHERE elementId(n) = $id RETURN n', {
		id: elementId,
	});
	if (!nodeRow) return null;

	const outgoing = await cypher<{
		relType: string;
		neighborId: string;
		neighborName: string;
		neighborLabel: string;
	}>(
		`MATCH (n)-[r]->(m) WHERE elementId(n) = $id
		 RETURN type(r) AS relType, elementId(m) AS neighborId,
		        m.name AS neighborName, labels(m)[0] AS neighborLabel`,
		{ id: elementId },
	);

	const incoming = await cypher<{
		relType: string;
		neighborId: string;
		neighborName: string;
		neighborLabel: string;
	}>(
		`MATCH (n)<-[r]-(m) WHERE elementId(n) = $id
		 RETURN type(r) AS relType, elementId(m) AS neighborId,
		        m.name AS neighborName, labels(m)[0] AS neighborLabel`,
		{ id: elementId },
	);

	return {
		elementId,
		labels: nodeRow.n.labels,
		properties: nodeRow.n.properties,
		connections: [
			...outgoing.map((c) => ({ direction: 'OUT' as const, ...c })),
			...incoming.map((c) => ({ direction: 'IN' as const, ...c })),
		],
	};
}

interface PathStep {
	elementId: string;
	name: string;
	label: string;
	relType?: string;
}

export async function findShortestPath(fromId: string, toId: string): Promise<PathStep[]> {
	const rows = await cypher<{ nodes: Neo4jNodeRecord[]; rels: Neo4jRelRecord[] }>(
		`MATCH (a), (b)
		 WHERE elementId(a) = $fromId AND elementId(b) = $toId
		 MATCH path = shortestPath((a)-[*..10]-(b))
		 RETURN [n IN nodes(path) | n] AS nodes, [r IN relationships(path) | r] AS rels`,
		{ fromId, toId },
	);

	if (rows.length === 0) return [];

	const { nodes, rels } = rows[0];
	const steps: PathStep[] = [];

	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		steps.push({
			elementId: n.elementId,
			name: (n.properties.name as string) ?? '?',
			label: n.labels[0],
			relType: i < rels.length ? rels[i].type : undefined,
		});
	}

	return steps;
}

interface Recommendation {
	elementId: string;
	name: string;
	label: string;
	score: number;
	via: string;
}

export async function getRecommendations(nodeId: string): Promise<Recommendation[]> {
	return cypher<Recommendation>(
		`MATCH (source) WHERE elementId(source) = $nodeId
		 MATCH (source)-[r1]-(intermediate)-[r2]-(recommended)
		 WHERE recommended <> source
		   AND NOT (source)-[]-(recommended)
		 WITH recommended, count(DISTINCT intermediate) AS score,
		      collect(DISTINCT intermediate.name)[0] AS via
		 RETURN elementId(recommended) AS elementId,
		        recommended.name AS name,
		        labels(recommended)[0] AS label,
		        score,
		        via
		 ORDER BY score DESC
		 LIMIT 10`,
		{ nodeId },
	);
}
