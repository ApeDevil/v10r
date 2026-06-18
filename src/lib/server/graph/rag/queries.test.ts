/**
 * Tenancy lock for the RAG graph reads (the cross-user graph-leak fix).
 *
 * Every read MUST constrain by ownerId and bind the caller's $ownerIds — so a
 * future refactor that drops the scope fails here. We mock the low-level `cypher`
 * runner and assert the generated statement + params, which is the contract the
 * Neo4j layer must satisfy regardless of the data in the graph.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cypherMock = vi.fn();
vi.mock('../index', () => ({ cypher: (...args: unknown[]) => cypherMock(...args) }));

const {
	getAllRagEntities,
	getEntityNeighborhood,
	findShortestPath,
	expandViaGraph,
	getEntitiesForChunks,
	getRagGraphStats,
} = await import('./queries');

const OWNERS = ['user-a', 'system-docs'];

beforeEach(() => {
	cypherMock.mockReset();
	cypherMock.mockResolvedValue([]);
});

/** Assert every cypher call was owner-scoped with the exact owner set. */
function expectAllCallsScoped(owners: string[]) {
	expect(cypherMock.mock.calls.length).toBeGreaterThan(0);
	for (const [statement, params] of cypherMock.mock.calls) {
		expect(statement).toMatch(/ownerId/);
		expect((params as { ownerIds?: unknown }).ownerIds).toEqual(owners);
	}
}

describe('RAG graph reads are tenant-scoped', () => {
	it('getAllRagEntities scopes nodes and edges', async () => {
		await getAllRagEntities(OWNERS);
		expectAllCallsScoped(OWNERS);
	});

	it('getEntityNeighborhood scopes the center and neighbors', async () => {
		await getEntityNeighborhood('elem-1', OWNERS);
		expectAllCallsScoped(OWNERS);
		for (const [, params] of cypherMock.mock.calls) {
			expect((params as { id?: string }).id).toBe('elem-1');
		}
	});

	it('findShortestPath scopes both endpoints and the path', async () => {
		await findShortestPath('a', 'b', OWNERS);
		expectAllCallsScoped(OWNERS);
		// the path predicate must guard every node on the path
		for (const [statement] of cypherMock.mock.calls) {
			expect(statement).toMatch(/all\(node IN nodes\(p\) WHERE node\.ownerId IN \$ownerIds\)/);
		}
	});

	it('expandViaGraph scopes the traversed entities and chunks', async () => {
		await expandViaGraph(['seed-1'], OWNERS, 2);
		expectAllCallsScoped(OWNERS);
		for (const [, params] of cypherMock.mock.calls) {
			expect((params as { seedChunkIds?: string[] }).seedChunkIds).toEqual(['seed-1']);
		}
	});

	it('getEntitiesForChunks scopes the mentioned entities', async () => {
		await getEntitiesForChunks(['chunk-1'], OWNERS);
		expectAllCallsScoped(OWNERS);
	});

	it('getRagGraphStats scopes the node and edge counts', async () => {
		await getRagGraphStats(OWNERS);
		expectAllCallsScoped(OWNERS);
	});
});
