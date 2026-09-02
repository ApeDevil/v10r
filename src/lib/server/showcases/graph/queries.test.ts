/**
 * Tenancy lock for the PUBLIC showcase graph reads (WS1 cross-user graph-leak fix).
 *
 * This Neo4j instance is SHARED: the demo "Tech Stack" graph co-resides with per-user
 * retrieval :Entity/:Chunk nodes. These showcase queries run on UNAUTHENTICATED routes, so
 * every graph-touching statement MUST constrain to the four demo labels and bind $demo —
 * a refactor that drops the scope re-opens an anonymous data leak and fails here. We mock
 * the low-level `cypher` runner and assert the generated statement + params, the contract
 * the Neo4j layer must satisfy regardless of the data actually in the graph.
 *
 * Sibling of `../../graph/retrieval/queries.test.ts` (the owner-scoped side of the same leak).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cypherMock = vi.fn();
vi.mock('$lib/server/graph', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/graph')>()),
	cypher: (...args: unknown[]) => cypherMock(...args),
}));

const {
	verifyConnection,
	getLabelsWithCounts,
	getRelTypesWithCounts,
	getFullGraph,
	getAllNodes,
	getNodeWithConnections,
	findDemoShortestPath,
	getRecommendations,
} = await import('./queries');

const DEMO_LABELS = ['Layer', 'Technology', 'Concept', 'Showcase'];

beforeEach(() => {
	cypherMock.mockReset();
	cypherMock.mockResolvedValue([]);
});

/**
 * Assert every graph-touching cypher call (any statement containing a `MATCH (`) is
 * demo-label-scoped: it references $demo and binds params.demo to the exact demo-label
 * set. Non-graph calls (e.g. `CALL dbms.components()`) expose no tenant data and are exempt.
 */
function expectAllGraphCallsDemoScoped() {
	expect(cypherMock.mock.calls.length).toBeGreaterThan(0);
	let graphCalls = 0;
	for (const [statement, params] of cypherMock.mock.calls) {
		if (!/MATCH\s*\(/.test(statement as string)) continue;
		graphCalls++;
		expect(statement).toMatch(/\$demo/);
		expect((params as { demo?: unknown }).demo).toEqual(DEMO_LABELS);
	}
	// A function that makes only non-graph calls would slip past the loop — require at least one.
	expect(graphCalls).toBeGreaterThan(0);
}

describe('showcase graph reads are demo-label-scoped (anon leak fix)', () => {
	it('verifyConnection scopes node/rel/label counts; the version probe is the only exempt call', async () => {
		await verifyConnection();
		expectAllGraphCallsDemoScoped();
		const componentsCall = cypherMock.mock.calls.find(([s]) => /dbms\.components/.test(s as string));
		expect(componentsCall).toBeDefined();
		expect(componentsCall?.[0]).not.toMatch(/MATCH\s*\(/); // carries no tenant data
	});

	it('getLabelsWithCounts derives counts from $demo, never CALL db.labels()', async () => {
		await getLabelsWithCounts();
		expectAllGraphCallsDemoScoped();
		for (const [statement] of cypherMock.mock.calls) {
			expect(statement).not.toMatch(/db\.labels\(\)/);
		}
	});

	it('getRelTypesWithCounts derives types from demo→demo edges, never CALL db.relationshipTypes()', async () => {
		await getRelTypesWithCounts();
		expectAllGraphCallsDemoScoped();
		for (const [statement] of cypherMock.mock.calls) {
			expect(statement).not.toMatch(/db\.relationshipTypes\(\)/);
		}
	});

	it('getFullGraph scopes both nodes and BOTH relationship endpoints', async () => {
		await getFullGraph();
		expectAllGraphCallsDemoScoped();
		const relCall = cypherMock.mock.calls.find(([s]) => /\[r\]->/.test(s as string));
		expect(relCall?.[0]).toMatch(/any\(l IN labels\(a\) WHERE l IN \$demo\)/);
		expect(relCall?.[0]).toMatch(/any\(l IN labels\(b\) WHERE l IN \$demo\)/);
	});

	it('getAllNodes scopes the node list', async () => {
		await getAllNodes();
		expectAllGraphCallsDemoScoped();
	});

	it('getNodeWithConnections: a leaked non-demo elementId returns null before any neighbor query runs', async () => {
		// center lookup finds no demo node (mock returns [])
		const result = await getNodeWithConnections('elem-leaked-entity');
		expect(result).toBeNull();
		// exactly one call (the guarded center lookup) — no neighbor enumeration on a miss
		expect(cypherMock.mock.calls).toHaveLength(1);
		const [statement, params] = cypherMock.mock.calls[0];
		expect(statement).toMatch(/elementId\(n\) = \$id AND any\(l IN labels\(n\) WHERE l IN \$demo\)/);
		expect((params as { id?: string }).id).toBe('elem-leaked-entity');
		expect((params as { demo?: unknown }).demo).toEqual(DEMO_LABELS);
	});

	it('getNodeWithConnections: neighbor queries guard the neighbor label on both directions', async () => {
		// center lookup returns a demo node so the neighbor queries actually run
		cypherMock.mockImplementation((statement: string) => {
			if (/RETURN n\s*$/.test(statement)) {
				return Promise.resolve([{ n: { elementId: 'elem-x', labels: ['Technology'], properties: { name: 'X' } } }]);
			}
			return Promise.resolve([]);
		});
		await getNodeWithConnections('elem-x');
		expectAllGraphCallsDemoScoped();
		const neighborCalls = cypherMock.mock.calls.filter(([s]) => /\[r\]->\(m\)|<-\[r\]-\(m\)/.test(s as string));
		expect(neighborCalls).toHaveLength(2);
		for (const [statement] of neighborCalls) {
			expect(statement).toMatch(/any\(l IN labels\(m\) WHERE l IN \$demo\)/);
		}
	});

	it('findDemoShortestPath guards both endpoints AND every node on the path', async () => {
		await findDemoShortestPath('a', 'b');
		expectAllGraphCallsDemoScoped();
		for (const [statement] of cypherMock.mock.calls) {
			// a path routed THROUGH a private node fails this predicate → zero rows
			expect(statement).toMatch(/all\(x IN nodes\(path\) WHERE any\(l IN labels\(x\) WHERE l IN \$demo\)\)/);
		}
	});

	it('getRecommendations guards source, intermediate, and recommended', async () => {
		await getRecommendations('n1');
		expectAllGraphCallsDemoScoped();
		const [statement] = cypherMock.mock.calls[0];
		expect(statement).toMatch(/any\(l IN labels\(source\) WHERE l IN \$demo\)/);
		expect(statement).toMatch(/any\(l IN labels\(intermediate\) WHERE l IN \$demo\)/);
		expect(statement).toMatch(/any\(l IN labels\(recommended\) WHERE l IN \$demo\)/);
	});
});
