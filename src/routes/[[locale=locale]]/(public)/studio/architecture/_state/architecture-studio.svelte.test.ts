import { describe, expect, it } from 'vitest';
import { createArchitectureModel, stringifyArchitectureFile } from '#patterns/architecture-engineering/index.ts';
import { createArchitectureDraftStore } from './architecture-drafts.ts';
import { createArchitectureStudio } from './architecture-studio.svelte.ts';

function memoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k) => map.get(k) ?? null,
		key: (i) => [...map.keys()][i] ?? null,
		removeItem: (k) => void map.delete(k),
		setItem: (k, v) => void map.set(k, v),
	};
}

function setup(storage: Storage = memoryStorage()) {
	let clock = 1_000_000;
	const store = createArchitectureDraftStore(
		() => storage,
		() => new Date(clock),
	);
	const studio = createArchitectureStudio({ store, now: () => clock });
	studio.hydrate();
	return { studio, store, storage, tick: (ms: number) => (clock += ms) };
}

describe('architecture studio state', () => {
	it('Explore → Design builds a model from the recommendation, as one undoable step', () => {
		const { studio } = setup();
		studio.applyExample('background-media-conversion');
		expect(studio.exampleId).toBe('background-media-conversion');
		studio.transferToDesign();
		expect(studio.model.nodes.length).toBeGreaterThan(0);
		expect(studio.notice?.text).toBe('transferred');
		studio.undo();
		expect(studio.model.nodes).toEqual([]);
	});

	it('editing a factor clears the example; reset returns every factor to unknown', () => {
		const { studio } = setup();
		studio.applyExample('lightweight-rest-api');
		studio.setFactor('latency', 'interactive');
		expect(studio.exampleId).toBeNull();
		studio.resetProfile();
		expect(studio.recommendation.unknown_factors.length).toBe(Object.keys(studio.profile).length);
	});

	it('adds, connects, refuses invalid changes, and undoes/redoes them', () => {
		const { studio, tick } = setup();
		const a = studio.addNode('browser-app') as string;
		tick(1000);
		const b = studio.addNode('app-server') as string;
		expect(studio.selection).toEqual({ type: 'node', id: b });
		expect(studio.connect(a, a)).toBeNull();
		expect(studio.refusal).toBe('connection.self');
		const link = studio.connect(a, b);
		expect(link).not.toBeNull();
		expect(studio.refusal).toBeNull();
		expect(studio.model.connections).toHaveLength(1);

		studio.select({ type: 'node', id: b });
		studio.removeSelected();
		expect(studio.model.connections).toHaveLength(0);
		expect(studio.selection).toBeNull();
		studio.undo();
		expect(studio.model.nodes.map((node) => node.id)).toContain(b);
		expect(studio.model.connections).toHaveLength(1);
		studio.redo();
		expect(studio.model.nodes.map((node) => node.id)).not.toContain(b);
	});

	it('coalesces typing into one undo step', () => {
		const { studio, tick } = setup();
		const id = studio.addNode('app-server') as string;
		const original = studio.model.nodes.find((node) => node.id === id)?.label;
		studio.updateNode(id, { label: 'A' }, 'label');
		tick(100);
		studio.updateNode(id, { label: 'Ap' }, 'label');
		tick(100);
		studio.updateNode(id, { label: 'Api' }, 'label');
		studio.undo();
		expect(studio.model.nodes.find((node) => node.id === id)?.label).toBe(original);
	});

	it('keeps the layout apart from the model: a move changes positions only', () => {
		const { studio } = setup();
		const id = studio.addNode('app-server') as string;
		const before = studio.model;
		studio.moveNode(id, { x: 400, y: 200 });
		expect(studio.model).toBe(before);
		expect(studio.layout.positions[id]).toEqual({ x: 400, y: 200 });
	});

	it('every accepted change survives a reload through the working copy', () => {
		const storage = memoryStorage();
		const first = setup(storage).studio;
		first.addNode('relational-db');
		const reloaded = setup(storage).studio;
		expect(reloaded.model.nodes.map((node) => node.kind)).toEqual(['relational-db']);
	});

	it('a variant saves its baseline and records why it changed', () => {
		const { studio } = setup();
		studio.addNode('app-server');
		const baselineId = studio.model.id;
		studio.createVariant('With worker', 'Media conversion blocks requests');
		expect(studio.model.derived_from).toBe(baselineId);
		expect(studio.model.change_reason).toBe('Media conversion blocks requests');
		expect(studio.drafts.map((draft) => draft.id).sort()).toEqual([baselineId, studio.model.id].sort());
		expect(studio.draftModel(baselineId)?.id).toBe(baselineId);
	});

	it('import refuses invalid text and leaves the model untouched; valid text replaces it', () => {
		const { studio } = setup();
		studio.addNode('app-server');
		const before = studio.model;
		expect(studio.importText('{"model":{"format":1,"nodes":"<script>"}}')).toBe(false);
		expect(studio.model).toBe(before);
		expect(studio.notice?.text).toBe('import-invalid');

		const other = createArchitectureModel('imported', 'Imported');
		expect(studio.importText(stringifyArchitectureFile({ model: other }))).toBe(true);
		expect(studio.model.id).toBe('imported');
		expect(studio.exportText()).toContain('"imported"');
	});

	it('the evolution example becomes four comparable drafts', () => {
		const { studio } = setup();
		studio.loadEvolutionExample();
		expect(studio.drafts).toHaveLength(4);
		expect(studio.model.derived_from).toBeDefined();
	});
});
