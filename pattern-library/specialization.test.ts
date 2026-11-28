/**
 * "Every specialization must satisfy the invariants of its generalization" (Slice 4), on the
 * committed registry. The structural half — no specialization weakens an inherited obligation — is
 * refused by the schema (`relationships.test.ts`); this file pins the reviewed outcome of each of
 * the four specializations, so a future edit that re-points one at a parent whose obligations it
 * does not meet fails here with the evidence named.
 */
import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../src/lib/server/patterns/registry.ts';
import { patternGraph } from './pattern-graph.ts';

const graph = patternGraph(REGISTRY);
const record = (id: string) => {
	const found = graph.byId.get(id);
	if (!found) throw new Error(`no record ${id}`);
	return found;
};

describe('the reviewed specializations', () => {
	it('are exactly the four reviewed in Slice 4', () => {
		const pairs = REGISTRY.patterns
			.filter((pattern) => pattern.specializes)
			.map((pattern) => `${pattern.id} ⊂ ${pattern.specializes?.id}`)
			.sort();
		expect(pairs).toEqual([
			'agentic-parametric-modeling ⊂ asset-production-engine',
			'asset-rights-manifest ⊂ source-of-truth-gate',
			'resource-anchor-integrity ⊂ source-of-truth-gate',
			'url-search-state ⊂ state-management',
		]);
	});

	it('MCP 3D specializes the engine, not the pipeline whose store and provenance it refuses', () => {
		// The child stores and records nothing (its own invariants); the pipeline's job layer does both.
		const child = record('agentic-parametric-modeling');
		expect(child.invariants.some((rule) => rule.startsWith('Nothing is stored'))).toBe(true);
		const pipeline = record('asset-production-pipeline');
		expect(pipeline.invariants.some((rule) => rule.startsWith('Stores are write-once'))).toBe(true);
		expect(graph.generalizations('agentic-parametric-modeling')).toEqual(['asset-production-engine']);
		// Nothing the engine requires or inherits is a store, a provenance record or a derivation key.
		const engine = record('asset-production-engine');
		expect(engine.invariants.join(' ')).not.toMatch(/\bstore|write-once|PROV-DM/i);
		const adopted = graph.adopt(['agentic-parametric-modeling']).steps;
		for (const job of ['asset-production-pipeline', 'provenance-record', 'derivation-key']) {
			expect(adopted).not.toContain(job);
		}
		// The pipeline keeps its job and runs the engine as a required constituent.
		const pipelineSteps = graph.adopt(['asset-production-pipeline']).steps;
		for (const id of ['asset-production-engine', 'provenance-record', 'derivation-key', 'rate-limiting']) {
			expect(pipelineSteps).toContain(id);
		}
		expect(graph.inheritedInvariants('agentic-parametric-modeling')).toEqual([
			{ from: 'asset-production-engine', invariants: engine.invariants },
		]);
	});

	it('the engine and the pipeline together keep every invariant the pipeline had before the extraction', () => {
		// The seven invariants of asset-production-pipeline at 19d25b9, one per line of its record.
		const before = [
			'Callers ask through one strict request schema',
			'The budget is checked from an exact estimate',
			'Same request, same bytes',
			'Every exported GLB passes inspection',
			'Findings are data with a fixed severity',
			'The core imports no framework, DOM or runtime API',
			'Stores are write-once and owner-scoped',
		];
		const now = [...record('asset-production-engine').invariants, ...record('asset-production-pipeline').invariants];
		for (const start of before) expect(now.some((rule) => rule.startsWith(start)), start).toBe(true);
	});

	it('the source-of-truth gates keep their non-empty controls; URL state is a kind of state management', () => {
		for (const id of ['asset-rights-manifest', 'resource-anchor-integrity']) {
			expect(graph.inheritedInvariants(id).map((entry) => entry.from)).toEqual(['source-of-truth-gate']);
			expect(record(id).tests.length).toBeGreaterThan(0);
		}
		expect(graph.inheritedInvariants('url-search-state')).toEqual([]);
	});
});
