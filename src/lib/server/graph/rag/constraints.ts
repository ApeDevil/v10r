import { cypher } from '../index';

const CONSTRAINTS = [
	'CREATE CONSTRAINT entity_name_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE',
	'CREATE CONSTRAINT chunk_pgid_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.pgId IS UNIQUE',
];

const INDEXES = [
	'CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)',
	'CREATE INDEX chunk_document IF NOT EXISTS FOR (c:Chunk) ON (c.documentId)',
	'CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (e:Entity) ON EACH [e.name, e.description]',
];

/** Create all RAG constraints and indexes (idempotent). */
export async function ensureRagConstraints(): Promise<void> {
	for (const stmt of [...CONSTRAINTS, ...INDEXES]) {
		await cypher(stmt);
	}
}
