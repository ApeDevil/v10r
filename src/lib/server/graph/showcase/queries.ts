import type { KnowledgeData } from '$lib/types/knowledge';
import { cypher } from '../index';
import type { Neo4jNodeRecord, Neo4jRelRecord } from '../types';
import { toKnowledgeData } from '../types';

// ─── Sanitization ──────────────────────────────────────

/** Strip non-alphanumeric characters to prevent Cypher injection via label/type names.
 *  Current queries use db.labels()/db.relationshipTypes() within Cypher's own WITH
 *  binding (not string interpolation), but this guards against second-order injection
 *  if queries are ever refactored or returned values are used downstream. */
function sanitizeIdentifier(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, '');
}

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
	const [counts, samples] = await Promise.all([
		cypher<{ label: string; count: number }>(
			`CALL db.labels() YIELD label
			 CALL {
			   WITH label
			   MATCH (n) WHERE label IN labels(n)
			   RETURN count(n) AS count
			 }
			 RETURN label, count`,
		),
		cypher<{ label: string; keys: string[] }>(
			`CALL db.labels() YIELD label
			 CALL {
			   WITH label
			   MATCH (n) WHERE label IN labels(n)
			   WITH n LIMIT 1
			   RETURN keys(n) AS keys
			 }
			 RETURN label, keys`,
		),
	]);

	const sampleMap = new Map(samples.map((s) => [s.label, s.keys ?? []]));

	return counts.map(({ label, count }) => ({
		label: sanitizeIdentifier(label),
		count: Number(count),
		sampleProperties: sampleMap.get(label) ?? [],
	}));
}

interface RelTypeInfo {
	type: string;
	count: number;
	startLabel: string;
	endLabel: string;
}

export async function getRelTypesWithCounts(): Promise<RelTypeInfo[]> {
	const [counts, samples] = await Promise.all([
		cypher<{ type: string; count: number }>(
			`CALL db.relationshipTypes() YIELD relationshipType
			 CALL {
			   WITH relationshipType
			   MATCH ()-[r]->() WHERE type(r) = relationshipType
			   RETURN count(r) AS count
			 }
			 RETURN relationshipType AS type, count`,
		),
		cypher<{ type: string; startLabel: string; endLabel: string }>(
			`CALL db.relationshipTypes() YIELD relationshipType
			 CALL {
			   WITH relationshipType
			   MATCH (a)-[r]->(b) WHERE type(r) = relationshipType
			   RETURN labels(a)[0] AS startLabel, labels(b)[0] AS endLabel
			   LIMIT 1
			 }
			 RETURN relationshipType AS type, startLabel, endLabel`,
		),
	]);

	const sampleMap = new Map(samples.map((s) => [s.type, { startLabel: s.startLabel, endLabel: s.endLabel }]));

	return counts.map(({ type, count }) => ({
		type: sanitizeIdentifier(type),
		count: Number(count),
		startLabel: sanitizeIdentifier(sampleMap.get(type)?.startLabel ?? '?'),
		endLabel: sanitizeIdentifier(sampleMap.get(type)?.endLabel ?? '?'),
	}));
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
