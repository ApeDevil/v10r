import type { Neo4jNodeRecord, Neo4jRelRecord } from '$lib/server/graph';
import { toKnowledgeData } from '$lib/server/graph';
import { cypher } from '$lib/server/graph/index';
import type { KnowledgeData } from '$lib/types/knowledge';

// This Neo4j instance is SHARED: alongside the public "Tech Stack" demo graph it
// also holds per-user retrieval `:Entity`/`:Chunk` nodes (owned via an `ownerId` property).
// Aura free = one database, so the demo can't live on a separate instance. Every
// query below is therefore constrained to the four demo labels so a public,
// unauthenticated showcase can NEVER read another user's private graph data.
// The arbitrary-Cypher REPL (which can't be label-constrained) is admin-gated at the
// route. See docs/stack/data/neo4j.md.
const DEMO_LABELS = ['Layer', 'Technology', 'Concept', 'Showcase'];

/** Strip non-alphanumeric characters to prevent Cypher injection via label/type names.
 *  Current queries use db.labels()/db.relationshipTypes() within Cypher's own WITH
 *  binding (not string interpolation), but this guards against second-order injection
 *  if queries are ever refactored or returned values are used downstream. */
function sanitizeIdentifier(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, '');
}

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
	// Node/rel/label/relType stats are scoped to the demo subgraph — the connection
	// page describes the demo, not the co-resident tenant retrieval data.
	const [components, nodeCounts, relCounts, labels, relTypes] = await Promise.all([
		cypher<{ name: string; versions: string[]; edition: string }>(
			`CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition`,
		),
		cypher<{ count: number }>('MATCH (n) WHERE any(l IN labels(n) WHERE l IN $demo) RETURN count(n) AS count', {
			demo: DEMO_LABELS,
		}),
		cypher<{ count: number }>(
			`MATCH (a)-[r]->(b)
			 WHERE any(l IN labels(a) WHERE l IN $demo) AND any(l IN labels(b) WHERE l IN $demo)
			 RETURN count(r) AS count`,
			{ demo: DEMO_LABELS },
		),
		cypher<{ label: string }>('UNWIND $demo AS label MATCH (n) WHERE label IN labels(n) RETURN DISTINCT label', {
			demo: DEMO_LABELS,
		}),
		cypher<{ relationshipType: string }>(
			`MATCH (a)-[r]->(b)
			 WHERE any(l IN labels(a) WHERE l IN $demo) AND any(l IN labels(b) WHERE l IN $demo)
			 RETURN DISTINCT type(r) AS relationshipType`,
			{ demo: DEMO_LABELS },
		),
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

interface LabelInfo {
	label: string;
	count: number;
	sampleProperties: string[];
}

export async function getLabelsWithCounts(): Promise<LabelInfo[]> {
	// Iterate the demo labels directly instead of CALL db.labels() (which would also
	// surface :Entity/:Chunk).
	const [counts, samples] = await Promise.all([
		cypher<{ label: string; count: number }>(
			`UNWIND $demo AS label
			 CALL {
			   WITH label
			   MATCH (n) WHERE label IN labels(n)
			   RETURN count(n) AS count
			 }
			 RETURN label, count`,
			{ demo: DEMO_LABELS },
		),
		cypher<{ label: string; keys: string[] }>(
			`UNWIND $demo AS label
			 CALL {
			   WITH label
			   MATCH (n) WHERE label IN labels(n)
			   WITH n LIMIT 1
			   RETURN keys(n) AS keys
			 }
			 RETURN label, keys`,
			{ demo: DEMO_LABELS },
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
	// Derive relationship types from demo→demo edges only (not CALL db.relationshipTypes()).
	const [counts, samples] = await Promise.all([
		cypher<{ type: string; count: number }>(
			`MATCH (a)-[r]->(b)
			 WHERE any(l IN labels(a) WHERE l IN $demo) AND any(l IN labels(b) WHERE l IN $demo)
			 RETURN type(r) AS type, count(r) AS count`,
			{ demo: DEMO_LABELS },
		),
		cypher<{ type: string; startLabel: string; endLabel: string }>(
			`MATCH (a)-[r]->(b)
			 WHERE any(l IN labels(a) WHERE l IN $demo) AND any(l IN labels(b) WHERE l IN $demo)
			 WITH type(r) AS type, labels(a)[0] AS startLabel, labels(b)[0] AS endLabel
			 RETURN type, collect(startLabel)[0] AS startLabel, collect(endLabel)[0] AS endLabel`,
			{ demo: DEMO_LABELS },
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
		cypher<{ n: Neo4jNodeRecord }>('MATCH (n) WHERE any(l IN labels(n) WHERE l IN $demo) RETURN n LIMIT 500', {
			demo: DEMO_LABELS,
		}),
		cypher<{ r: Neo4jRelRecord; startId: string; endId: string }>(
			`MATCH (a)-[r]->(b)
			 WHERE any(l IN labels(a) WHERE l IN $demo) AND any(l IN labels(b) WHERE l IN $demo)
			 RETURN r, elementId(a) AS startId, elementId(b) AS endId
			 LIMIT 1000`,
			{ demo: DEMO_LABELS },
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

interface NodeSummary {
	elementId: string;
	label: string;
	name: string;
}

export async function getAllNodes(): Promise<NodeSummary[]> {
	return cypher<NodeSummary>(
		`MATCH (n) WHERE any(l IN labels(n) WHERE l IN $demo)
		 RETURN elementId(n) AS elementId, labels(n)[0] AS label, n.name AS name
		 ORDER BY labels(n)[0], n.name
		 LIMIT 500`,
		{ demo: DEMO_LABELS },
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
	// Central node must be a demo node — a leaked :Entity elementId returns null.
	const [nodeRow] = await cypher<{ n: Neo4jNodeRecord }>(
		'MATCH (n) WHERE elementId(n) = $id AND any(l IN labels(n) WHERE l IN $demo) RETURN n',
		{ id: elementId, demo: DEMO_LABELS },
	);
	if (!nodeRow) return null;

	// Neighbors are likewise constrained to demo labels (defense in depth against a
	// hypothetical cross-subgraph relationship).
	const [outgoing, incoming] = await Promise.all([
		cypher<{
			relType: string;
			neighborId: string;
			neighborName: string;
			neighborLabel: string;
		}>(
			`MATCH (n)-[r]->(m) WHERE elementId(n) = $id AND any(l IN labels(m) WHERE l IN $demo)
			 RETURN type(r) AS relType, elementId(m) AS neighborId,
			        m.name AS neighborName, labels(m)[0] AS neighborLabel`,
			{ id: elementId, demo: DEMO_LABELS },
		),
		cypher<{
			relType: string;
			neighborId: string;
			neighborName: string;
			neighborLabel: string;
		}>(
			`MATCH (n)<-[r]-(m) WHERE elementId(n) = $id AND any(l IN labels(m) WHERE l IN $demo)
			 RETURN type(r) AS relType, elementId(m) AS neighborId,
			        m.name AS neighborName, labels(m)[0] AS neighborLabel`,
			{ id: elementId, demo: DEMO_LABELS },
		),
	]);

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

export async function findDemoShortestPath(fromId: string, toId: string): Promise<PathStep[]> {
	const rows = await cypher<{ nodes: Neo4jNodeRecord[]; rels: Neo4jRelRecord[] }>(
		`MATCH (a), (b)
		 WHERE elementId(a) = $fromId AND elementId(b) = $toId
		   AND any(l IN labels(a) WHERE l IN $demo) AND any(l IN labels(b) WHERE l IN $demo)
		 MATCH path = shortestPath((a)-[*..10]-(b))
		 WHERE all(x IN nodes(path) WHERE any(l IN labels(x) WHERE l IN $demo))
		 RETURN [n IN nodes(path) | n] AS nodes, [r IN relationships(path) | r] AS rels`,
		{ fromId, toId, demo: DEMO_LABELS },
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
		`MATCH (source) WHERE elementId(source) = $nodeId AND any(l IN labels(source) WHERE l IN $demo)
		 MATCH (source)-[r1]-(intermediate)-[r2]-(recommended)
		 WHERE recommended <> source
		   AND NOT (source)-[]-(recommended)
		   AND any(l IN labels(intermediate) WHERE l IN $demo)
		   AND any(l IN labels(recommended) WHERE l IN $demo)
		 WITH recommended, count(DISTINCT intermediate) AS score,
		      collect(DISTINCT intermediate.name)[0] AS via
		 RETURN elementId(recommended) AS elementId,
		        recommended.name AS name,
		        labels(recommended)[0] AS label,
		        score,
		        via
		 ORDER BY score DESC
		 LIMIT 10`,
		{ nodeId, demo: DEMO_LABELS },
	);
}
