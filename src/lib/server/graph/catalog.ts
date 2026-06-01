/**
 * Catalog graph seeding — write the derived `Resource` projection into Neo4j.
 *
 * Idempotent: MERGE every node + `PART_OF` edge by stable id, then delete-not-seen
 * so a removed showcase/section tombstones. `registry.ts` stays the single source of
 * truth; the graph is a rebuildable derivation (no dual source-of-truth drift).
 *
 * The Cypher executor is INJECTED (`CypherRunner`) rather than imported, so this
 * module stays free of `$env/dynamic/private` and runs from the `db:catalog-sync`
 * Bun script as well as from the app (pass `cypher` from `$lib/server/graph`).
 */
import type { CatalogEdge, CatalogResourceNode } from '../search/catalog-projection';

/** Matches the signature of `cypher()` from `$lib/server/graph`. */
export type CypherRunner = <T = Record<string, unknown>>(
	statement: string,
	parameters?: Record<string, unknown>,
) => Promise<T[]>;

export interface SeedResult {
	nodes: number;
	edges: number;
	removed: number;
}

export async function seedCatalogResources(
	run: CypherRunner,
	resources: CatalogResourceNode[],
	edges: CatalogEdge[],
): Promise<SeedResult> {
	if (resources.length > 0) {
		await run(
			`UNWIND $resources AS r
			 MERGE (n:Resource { id: r.id })
			 SET n.surface = r.surface, n.kind = r.kind, n.title = r.title, n.path = r.path, n.anchor = r.anchor`,
			{ resources },
		);
	}

	if (edges.length > 0) {
		await run(
			`UNWIND $edges AS e
			 MATCH (c:Resource { id: e.from })
			 MATCH (p:Resource { id: e.to })
			 MERGE (c)-[:PART_OF]->(p)`,
			{ edges },
		);
	}

	// Reconcile: drop Resource nodes whose id is absent from this build. Guarded on a
	// non-empty id set so an empty derivation never nukes the whole label.
	let removed = 0;
	if (resources.length > 0) {
		const ids = resources.map((r) => r.id);
		const res = await run<{ removed: number }>(
			`MATCH (n:Resource)
			 WHERE NOT n.id IN $ids
			 WITH collect(n) AS doomed
			 FOREACH (d IN doomed | DETACH DELETE d)
			 RETURN size(doomed) AS removed`,
			{ ids },
		);
		removed = res[0]?.removed ?? 0;
	}

	return { nodes: resources.length, edges: edges.length, removed };
}
