/**
 * Neo4j RAG constraints and indexes setup.
 * Usage: bun run db:neo4j-setup
 *
 * Creates uniqueness constraints, property indexes, and fulltext index
 * for the RAG graph model. All statements use IF NOT EXISTS — idempotent.
 */

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
	console.error('Missing env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD');
	process.exit(1);
}

const host = NEO4J_URI.replace(/^neo4j(\+s)?:\/\//, 'https://');
const database = process.env.NEO4J_DATABASE || 'neo4j';
const auth = `Basic ${btoa(`${NEO4J_USERNAME}:${NEO4J_PASSWORD}`)}`;

async function cypher(statement: string): Promise<void> {
	const response = await fetch(`${host}/db/${database}/query/v2`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			Authorization: auth,
		},
		body: JSON.stringify({ statement }),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => 'No body');
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	const result = await response.json();
	if (result.errors?.length) {
		throw new Error(result.errors[0].message);
	}
}

const STATEMENTS = [
	// Constraints
	'CREATE CONSTRAINT entity_name_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE',
	'CREATE CONSTRAINT chunk_pgid_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.pgId IS UNIQUE',
	// Indexes
	'CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)',
	'CREATE INDEX chunk_document IF NOT EXISTS FOR (c:Chunk) ON (c.documentId)',
	'CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (e:Entity) ON EACH [e.name, e.description]',
];

async function main() {
	for (const stmt of STATEMENTS) {
		const label = stmt.match(/(?:CONSTRAINT|INDEX)\s+(\S+)/)?.[1] ?? stmt.slice(0, 40);
		console.log(`[neo4j:setup] Creating ${label}...`);
		await cypher(stmt);
	}
	console.log('[neo4j:setup] Done.');
}

main().catch((err) => {
	console.error('[neo4j:setup] Failed:', err instanceof Error ? err.message : err);
	process.exit(1);
});
