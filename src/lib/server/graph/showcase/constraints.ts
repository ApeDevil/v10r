import { cypher } from '../index';

const CONSTRAINTS = [
	'CREATE CONSTRAINT technology_name_unique IF NOT EXISTS FOR (t:Technology) REQUIRE t.name IS UNIQUE',
	'CREATE CONSTRAINT concept_name_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE',
	'CREATE CONSTRAINT layer_name_unique IF NOT EXISTS FOR (l:Layer) REQUIRE l.name IS UNIQUE',
	'CREATE CONSTRAINT showcase_name_unique IF NOT EXISTS FOR (s:Showcase) REQUIRE s.name IS UNIQUE',
	// Existence constraints — prevent incomplete nodes
	'CREATE CONSTRAINT technology_category_exists IF NOT EXISTS FOR (t:Technology) REQUIRE t.category IS NOT NULL',
	'CREATE CONSTRAINT layer_order_exists IF NOT EXISTS FOR (l:Layer) REQUIRE l.order IS NOT NULL',
	'CREATE CONSTRAINT showcase_path_exists IF NOT EXISTS FOR (s:Showcase) REQUIRE s.path IS NOT NULL',
];

const INDEXES = ['CREATE INDEX technology_category IF NOT EXISTS FOR (t:Technology) ON (t.category)'];

/** Create all uniqueness constraints and indexes (idempotent). */
export async function ensureConstraints(): Promise<void> {
	for (const stmt of [...CONSTRAINTS, ...INDEXES]) {
		await cypher(stmt);
	}
}
