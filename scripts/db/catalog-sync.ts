#!/usr/bin/env bun
/**
 * Seed the project catalog (showcase domains / modules / components + sections) as
 * typed `:Resource` nodes + `PART_OF` edges in Neo4j. Idempotent: MERGE by stable id
 * + delete-not-seen, so `registry.ts` stays the single source of truth and the graph
 * is a rebuildable projection. Chained into `db:setup` after `db:neo4j-setup`.
 *
 * Reimplements a minimal `cypher` (env + HTTP Query API) — same pattern as
 * `scripts/db/setup-neo4j.ts` — so the script never imports `$env/dynamic/private`.
 * Run: bun run db:catalog-sync
 */
import { seedCatalogResources } from '../../src/lib/server/graph/catalog';
import { deriveCatalogGraph } from '../../src/lib/server/search/catalog-projection';

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
	console.error('Missing env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD');
	process.exit(1);
}

const host = NEO4J_URI.replace(/^neo4j(\+s)?:\/\//, 'https://');
const database = process.env.NEO4J_DATABASE || 'neo4j';
const authHeader = `Basic ${btoa(`${NEO4J_USERNAME}:${NEO4J_PASSWORD}`)}`;

async function cypher<T = Record<string, unknown>>(
	statement: string,
	parameters?: Record<string, unknown>,
): Promise<T[]> {
	const response = await fetch(`${host}/db/${database}/query/v2`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
		body: JSON.stringify(parameters ? { statement, parameters } : { statement }),
	});
	if (!response.ok) {
		throw new Error(`Neo4j HTTP ${response.status}: ${await response.text().catch(() => '')}`);
	}
	const result = (await response.json()) as {
		data?: { fields: string[]; values: unknown[][] };
		errors?: Array<{ message: string; code: string }>;
	};
	if (result.errors?.length) throw new Error(`Neo4j: ${result.errors[0].message}`);
	if (!result.data) return [];
	const { fields, values } = result.data;
	return values.map((row) => {
		const rec: Record<string, unknown> = {};
		for (let i = 0; i < fields.length; i++) rec[fields[i]] = row[i];
		return rec as T;
	}) as T[];
}

async function run() {
	// Uniqueness constraint on Resource.id (idempotent) → MERGE-by-id is safe + fast.
	await cypher('CREATE CONSTRAINT resource_id IF NOT EXISTS FOR (r:Resource) REQUIRE r.id IS UNIQUE');

	const { resources, edges } = deriveCatalogGraph();
	console.log(`[catalog-sync] derived ${resources.length} resources, ${edges.length} PART_OF edges`);

	const result = await seedCatalogResources(cypher, resources, edges);
	console.log(`[catalog-sync] seeded ${result.nodes} nodes, ${result.edges} edges; removed ${result.removed} stale`);
}

await run();
console.log('\n[ok] catalog graph sync complete');
