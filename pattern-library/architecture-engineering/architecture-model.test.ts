import { describe, expect, it } from 'vitest';
import {
	type ArchitectureModel,
	MODEL_LIMITS,
	parseArchitectureFile,
	parseArchitectureModel,
	stringifyArchitectureFile,
} from './architecture-model.ts';
import { compareArchitectures } from './compare.ts';
import { DECISION_CATALOG } from './decision-catalog.ts';
import { evolutionExample } from './evolution-examples.ts';
import { exploreWorkload } from './explore.ts';
import { layoutByZone, modelFromRecommendation } from './model-from-recommendation.ts';
import {
	addConnection,
	addNode,
	createArchitectureModel,
	deriveVariant,
	removeConnection,
	removeNode,
	removeZone,
	updateConnection,
	updateNode,
} from './model-operations.ts';
import { WORKLOAD_EXAMPLES } from './workload-examples.ts';

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
	if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
	return result as Extract<T, { ok: true }>;
}

function sample(): ArchitectureModel {
	let model = createArchitectureModel('sample', 'Sample');
	model = ok(addNode(model, { kind: 'browser-app' })).model;
	model = ok(addNode(model, { kind: 'app-server' })).model;
	model = ok(addNode(model, { kind: 'relational-db' })).model;
	model = ok(addConnection(model, { from: 'browser-app', to: 'app-server' })).model;
	return ok(addConnection(model, { from: 'app-server', to: 'relational-db' })).model;
}

describe('model operations', () => {
	it('generates stable ids from the kind and puts nodes in their kind’s zone', () => {
		let model = sample();
		model = ok(addNode(model, { kind: 'app-server' })).model;
		expect(model.nodes.map((node) => node.id)).toEqual(['browser-app', 'app-server', 'relational-db', 'app-server-2']);
		expect(model.nodes.find((node) => node.id === 'relational-db')?.zone).toBe('data');
	});

	it('picks a protocol the target accepts by default', () => {
		const model = sample();
		expect(model.connections.map((connection) => connection.protocol)).toEqual(['http-rest', 'sql']);
	});

	it('removing a node removes its connections — nothing dangles', () => {
		const model = ok(removeNode(sample(), 'app-server')).model;
		expect(model.connections).toEqual([]);
		expect(parseArchitectureModel(model).ok).toBe(true);
	});

	it('refuses self-connections, duplicates, unknown nodes and disallowed placements, leaving the model untouched', () => {
		const model = sample();
		const before = JSON.stringify(model);
		expect(addConnection(model, { from: 'app-server', to: 'app-server' })).toEqual({
			ok: false,
			refusal: 'connection.self',
		});
		expect(addConnection(model, { from: 'browser-app', to: 'app-server' })).toEqual({
			ok: false,
			refusal: 'connection.duplicate',
		});
		expect(addConnection(model, { from: 'ghost', to: 'app-server' })).toEqual({ ok: false, refusal: 'node.unknown' });
		expect(updateNode(model, 'relational-db', { placement: 'browser-main-thread' })).toEqual({
			ok: false,
			refusal: 'placement.not-allowed',
		});
		expect(removeZone(model, 'data')).toEqual({ ok: false, refusal: 'zone.in-use' });
		expect(JSON.stringify(model)).toBe(before);
	});

	it('updates connection properties and removes connections', () => {
		let model = sample();
		const id = model.connections[0].id;
		model = ok(updateConnection(model, id, { authenticated: 'yes', failure_handling: 'timeout' })).model;
		expect(model.connections[0]).toMatchObject({ authenticated: 'yes', failure_handling: 'timeout' });
		model = ok(removeConnection(model, id)).model;
		expect(model.connections).toHaveLength(1);
	});

	it('a variant keeps node ids so a comparison can match them, and records why it exists', () => {
		const variant = deriveVariant(sample(), 'sample-b', 'Sample B', 'Add a worker');
		expect(variant).toMatchObject({ id: 'sample-b', derived_from: 'sample', change_reason: 'Add a worker' });
		expect(variant.nodes.map((node) => node.id)).toEqual(sample().nodes.map((node) => node.id));
	});
});

describe('parseArchitectureModel (untrusted input)', () => {
	it('accepts what the operations produce', () => {
		expect(parseArchitectureModel(sample()).ok).toBe(true);
	});

	it('refuses an unsupported format version', () => {
		const result = parseArchitectureModel({ ...sample(), format: 2 });
		expect(!result.ok && result.issues[0].message).toMatch(/unsupported format 2/);
	});

	it('refuses unknown keys instead of dropping them', () => {
		const model = sample() as unknown as Record<string, unknown>;
		const result = parseArchitectureModel({ ...model, script: 'alert(1)' });
		expect(!result.ok && result.issues.map((issue) => issue.path)).toContain('script');
	});

	it('refuses dangling references, duplicate ids and placements a kind cannot have', () => {
		const model = sample();
		const broken = {
			...model,
			nodes: [...model.nodes, { ...model.nodes[0] }, { ...model.nodes[2], id: 'db-2', placement: 'browser-worker' }],
			connections: [...model.connections, { ...model.connections[0], id: 'ghost-link', to: 'ghost' }],
		};
		const result = parseArchitectureModel(broken);
		const messages = !result.ok ? result.issues.map((issue) => issue.message).join('\n') : '';
		expect(messages).toMatch(/duplicate id "browser-app"/);
		expect(messages).toMatch(/node "ghost" does not exist/);
		expect(messages).toMatch(/cannot run as browser-worker/);
	});

	it('refuses oversized input rather than truncating it', () => {
		const model = sample();
		const many = Array.from({ length: MODEL_LIMITS.nodes + 1 }, (_, index) => ({
			...model.nodes[1],
			id: `n-${index}`,
		}));
		expect(parseArchitectureModel({ ...model, nodes: many, connections: [] }).ok).toBe(false);
		expect(parseArchitectureFile('x'.repeat(MODEL_LIMITS.fileBytes + 1)).ok).toBe(false);
	});

	it('refuses ids that are not kebab-case (no markup, no paths)', () => {
		const model = sample();
		const result = parseArchitectureModel({
			...model,
			nodes: [{ ...model.nodes[0], id: '<img src=x>' }],
			connections: [],
		});
		expect(result.ok).toBe(false);
	});

	it('handles corrupt files without throwing', () => {
		for (const text of ['', '{', 'null', '[]', '{"model": 3}', '{"model": {}, "extra": 1}']) {
			expect(parseArchitectureFile(text).ok).toBe(false);
		}
	});
});

describe('serialization', () => {
	it('export → import → export is byte-equal, and order of keyed collections does not matter', () => {
		const model = sample();
		const layout = layoutByZone(model);
		const text = stringifyArchitectureFile({ model, layout });
		const parsed = ok(parseArchitectureFile(text));
		expect(stringifyArchitectureFile(parsed.file)).toBe(text);
		const shuffled = { ...model, nodes: [...model.nodes].reverse() };
		expect(stringifyArchitectureFile({ model: shuffled, layout })).toBe(text);
	});

	it('keeps the layout separate and drops positions for nodes that do not exist', () => {
		const model = sample();
		const text = JSON.stringify({
			model,
			layout: { format: 1, positions: { 'browser-app': { x: 1, y: 2 }, ghost: { x: 0, y: 0 } } },
		});
		const parsed = ok(parseArchitectureFile(text));
		expect(parsed.file.layout?.positions).toEqual({ 'browser-app': { x: 1, y: 2 } });
		expect(JSON.stringify(parsed.file.model)).not.toMatch(/"x"/);
	});
});

describe('transfer from Explore', () => {
	for (const example of WORKLOAD_EXAMPLES) {
		it(`${example.id} produces a valid model`, () => {
			const model = modelFromRecommendation(exploreWorkload(DECISION_CATALOG, example.profile));
			expect(parseArchitectureModel(model).ok).toBe(true);
			expect(
				model.nodes.every((node) => node.decisions.every((id) => DECISION_CATALOG.decisions.some((d) => d.id === id))),
			).toBe(true);
		});
	}

	it('different workloads lead to different structures', () => {
		const shape = (id: string) => {
			const example = WORKLOAD_EXAMPLES.find((entry) => entry.id === id);
			if (!example) throw new Error(id);
			return modelFromRecommendation(exploreWorkload(DECISION_CATALOG, example.profile))
				.nodes.map((node) => node.kind)
				.sort();
		};
		expect(shape('local-image-processing')).toEqual(expect.arrayContaining(['browser-worker', 'wasm-module']));
		expect(shape('background-media-conversion')).toEqual(
			expect.arrayContaining(['background-worker', 'object-storage']),
		);
		expect(shape('scale-heavy-backend')).toContain('compute-service');
		expect(shape('lightweight-rest-api')).not.toContain('compute-service');
	});
});

describe('evolution example', () => {
	const stages = evolutionExample();

	it('every stage is a valid model derived from the one before, with a reason', () => {
		stages.forEach((stage, index) => {
			expect(parseArchitectureModel(stage).ok).toBe(true);
			if (index > 0) {
				expect(stage.derived_from).toBe(stages[index - 1].id);
				expect(stage.change_reason?.length).toBeGreaterThan(20);
			}
		});
	});

	it('adding components shows up as added complexity, not as a score', () => {
		const comparison = compareArchitectures(stages[1], stages[2]);
		expect(comparison.derived).toBe(true);
		expect(comparison.nodes.added.map((node) => node.id)).toEqual(['solver-service']);
		expect(comparison.variant.deployment_units.length).toBeGreaterThan(comparison.baseline.deployment_units.length);
		expect(comparison.requirements.added).toContain('container-host');
		expect(comparison.assessment.every((entry) => entry.basis === 'qualitative')).toBe(true);
		expect(comparison.assessment.find((entry) => entry.dimension === 'deployment-complexity')?.statement).toMatch(
			/adds 1 deployment unit/,
		);
	});

	it('comparison statements never present a number as a measured latency', () => {
		const comparison = compareArchitectures(stages[0], stages[3]);
		const latency = comparison.assessment.find((entry) => entry.dimension === 'latency')?.statement ?? '';
		expect(latency).toMatch(/not measured/);
		expect(latency).not.toMatch(/\d+\s*ms/);
	});

	it('the service stage leaves failure handling unknown, and the comparison reports it as introduced', () => {
		const comparison = compareArchitectures(stages[1], stages[2]);
		expect(comparison.findings.introduced.map((entry) => entry.code)).toContain('boundary.failure-unknown');
	});
});
