/**
 * The Studio's state for Architecture Engineering: the workload profile Explore edits, the
 * architecture model Design edits (with its separate layout), undo/redo, the selection, and
 * the local drafts. One instance lives in the area's `+layout.svelte`, so moving between
 * Explore, Design and Engineer keeps every edit.
 *
 * A thin reactive shell over the pure core in `#patterns/architecture-engineering`: every
 * model change is an operation that returns a new model or a refusal. The model is
 * `$state.raw`, replaced on every change and never deep-proxied (the attribute-editor
 * convention). Every accepted change is also written to the working copy, so a reload, a
 * crash or a closed tab loses nothing; "Save" files it as a named draft.
 */
import { getContext, setContext } from 'svelte';
import {
	type ArchitectureFile,
	type ArchitectureLayout,
	type ArchitectureModel,
	addConnection,
	addNode,
	type ConnectionPatch,
	checkArchitecture,
	createArchitectureModel,
	DECISION_CATALOG,
	deriveVariant,
	evolutionExample,
	exploreWorkload,
	findWorkloadExample,
	freeModelId,
	layoutByZone,
	type ModelIssue,
	type ModelOperation,
	type ModelRefusal,
	modelFromRecommendation,
	type NodeKind,
	type NodePatch,
	parseArchitectureFile,
	removeConnection,
	removeNode,
	stringifyArchitectureFile,
	unknownProfile,
	updateConnection,
	updateModelInfo,
	updateNode,
	type WorkloadFactor,
	type WorkloadProfile,
} from '#patterns/architecture-engineering/index.ts';
import type { ArchitectureDraftEntry, ArchitectureDraftStore } from './architecture-drafts.ts';

const HISTORY_LIMIT = 100;
/** Consecutive edits of the same field within this window are one undo step (typing a word). */
const COALESCE_MS = 800;

interface Snapshot {
	model: ArchitectureModel;
	layout: ArchitectureLayout;
}

export type StudioSelection = { type: 'node' | 'connection'; id: string } | null;

export interface StudioNotice {
	tone: 'info' | 'success' | 'error';
	text: string;
	issues?: ModelIssue[];
}

export interface ArchitectureStudioOptions {
	store: ArchitectureDraftStore;
	now?: () => number;
}

function emptyLayout(): ArchitectureLayout {
	return { format: 1, positions: {} };
}

export function createArchitectureStudio(options: ArchitectureStudioOptions) {
	const { store } = options;
	const now = options.now ?? (() => Date.now());

	let profile = $state<WorkloadProfile>(unknownProfile());
	let exampleId = $state<string | null>(null);
	const recommendation = $derived(exploreWorkload(DECISION_CATALOG, profile));

	let model = $state.raw<ArchitectureModel>(createArchitectureModel('untitled', 'Untitled architecture'));
	let layout = $state.raw<ArchitectureLayout>(emptyLayout());
	let past = $state.raw<Snapshot[]>([]);
	let future = $state.raw<Snapshot[]>([]);
	let lastEdit: { key: string; at: number } | null = null;
	let refusal = $state<ModelRefusal | null>(null);
	let selection = $state<StudioSelection>(null);
	let drafts = $state.raw<ArchitectureDraftEntry[]>([]);
	let notice = $state<StudioNotice | null>(null);
	/** True once the browser-only state (drafts, working copy) has been read. */
	let hydrated = $state(false);

	const findings = $derived(checkArchitecture(model));

	function persistWorking() {
		store.saveWorking({ model, layout });
	}

	/** Make `next` current, recording the previous state for undo. */
	function commit(next: Snapshot, coalesce?: string) {
		const at = now();
		const merging = coalesce !== undefined && lastEdit?.key === coalesce && at - lastEdit.at < COALESCE_MS;
		if (!merging) past = [...past, { model, layout }].slice(-HISTORY_LIMIT);
		lastEdit = coalesce === undefined ? null : { key: coalesce, at };
		future = [];
		model = next.model;
		layout = next.layout;
		persistWorking();
	}

	function apply(result: ModelOperation, coalesce?: string): string | null {
		if (!result.ok) {
			refusal = result.refusal;
			return null;
		}
		refusal = null;
		if (result.model === model) return result.id ?? null;
		const positions = { ...layout.positions };
		for (const id of Object.keys(positions))
			if (!result.model.nodes.some((node) => node.id === id)) delete positions[id];
		commit({ model: result.model, layout: { format: 1, positions } }, coalesce);
		return result.id ?? null;
	}

	/** Replace the whole document (open, import, transfer) — one undoable step. */
	function replace(file: ArchitectureFile) {
		commit({ model: file.model, layout: file.layout ?? layoutByZone(file.model) });
		selection = null;
		refusal = null;
	}

	function placeNew(id: string | null) {
		if (!id || layout.positions[id]) return;
		const count = model.nodes.length;
		layout = { format: 1, positions: { ...layout.positions, [id]: { x: 80 + (count % 4) * 60, y: 40 + count * 30 } } };
		persistWorking();
	}

	function travel(from: Snapshot[], to: Snapshot[]): [Snapshot[], Snapshot[]] | null {
		const target = from.at(-1);
		if (!target) return null;
		const next: [Snapshot[], Snapshot[]] = [from.slice(0, -1), [...to, { model, layout }]];
		model = target.model;
		layout = target.layout;
		lastEdit = null;
		refusal = null;
		if (selection && !exists(selection)) selection = null;
		persistWorking();
		return next;
	}

	function exists(target: NonNullable<StudioSelection>): boolean {
		return target.type === 'node'
			? model.nodes.some((node) => node.id === target.id)
			: model.connections.some((connection) => connection.id === target.id);
	}

	function newModelId(base: string): string {
		return freeModelId(
			`${base}-${now().toString(36)}`,
			drafts.map((entry) => entry.id),
		);
	}

	return {
		// ── Explore ──
		get profile() {
			return profile;
		},
		get exampleId() {
			return exampleId;
		},
		get recommendation() {
			return recommendation;
		},
		setFactor(factor: WorkloadFactor, value: string) {
			profile = { ...profile, [factor]: value } as WorkloadProfile;
			exampleId = null;
		},
		applyExample(id: string) {
			const example = findWorkloadExample(id);
			if (!example) return;
			profile = { ...example.profile };
			exampleId = id;
		},
		resetProfile() {
			profile = unknownProfile();
			exampleId = null;
		},
		/** Explore → Design: build a starting model from the current recommendation. */
		transferToDesign() {
			const example = exampleId ? findWorkloadExample(exampleId) : undefined;
			const id = newModelId('explored');
			const built = modelFromRecommendation(recommendation, id, example ? example.title : 'Explored architecture');
			replace({ model: built, layout: layoutByZone(built) });
			notice = { tone: 'success', text: 'transferred' };
		},

		// ── Design ──
		get model() {
			return model;
		},
		get layout() {
			return layout;
		},
		get findings() {
			return findings;
		},
		get refusal() {
			return refusal;
		},
		get selection() {
			return selection;
		},
		get canUndo() {
			return past.length > 0;
		},
		get canRedo() {
			return future.length > 0;
		},
		select(next: StudioSelection) {
			selection = next;
		},
		addNode(kind: NodeKind) {
			const id = apply(addNode(model, { kind }));
			placeNew(id);
			if (id) selection = { type: 'node', id };
			return id;
		},
		updateNode(id: string, patch: NodePatch, coalesce?: string) {
			return apply(updateNode(model, id, patch), coalesce ? `node:${id}:${coalesce}` : undefined);
		},
		connect(from: string, to: string) {
			const id = apply(addConnection(model, { from, to }));
			if (id) selection = { type: 'connection', id };
			return id;
		},
		updateConnection(id: string, patch: ConnectionPatch, coalesce?: string) {
			return apply(updateConnection(model, id, patch), coalesce ? `connection:${id}:${coalesce}` : undefined);
		},
		removeSelected() {
			if (!selection) return;
			const result =
				selection.type === 'node' ? removeNode(model, selection.id) : removeConnection(model, selection.id);
			apply(result);
			if (result.ok) selection = null;
		},
		/** A finished drag: one undo step. */
		moveNode(id: string, position: { x: number; y: number }) {
			const current = layout.positions[id];
			if (current && current.x === position.x && current.y === position.y) return;
			commit({ model, layout: { format: 1, positions: { ...layout.positions, [id]: position } } });
		},
		updateInfo(patch: Parameters<typeof updateModelInfo>[1], coalesce?: string) {
			apply(updateModelInfo(model, patch), coalesce ? `model:${coalesce}` : undefined);
		},
		autoLayout() {
			commit({ model, layout: layoutByZone(model) });
		},
		undo() {
			const moved = travel(past, future);
			if (moved) [past, future] = moved;
		},
		redo() {
			const moved = travel(future, past);
			if (moved) [future, past] = moved;
		},
		newModel() {
			replace({
				model: createArchitectureModel(newModelId('architecture'), 'Untitled architecture'),
				layout: emptyLayout(),
			});
		},

		// ── Drafts, files, variants ──
		get drafts() {
			return drafts;
		},
		get hydrated() {
			return hydrated;
		},
		get notice() {
			return notice;
		},
		dismissNotice() {
			notice = null;
		},
		/** Read browser-only state. Called once from the layout after mount. */
		hydrate() {
			drafts = store.list();
			const working = store.loadWorking();
			if (working.ok) {
				model = working.file.model;
				layout = working.file.layout ?? layoutByZone(working.file.model);
			} else if (working.reason === 'corrupt') {
				notice = { tone: 'error', text: 'working-corrupt', issues: working.issues };
			}
			hydrated = true;
		},
		save() {
			const result = store.save({ model, layout });
			drafts = store.list();
			notice = result.ok ? { tone: 'success', text: 'saved' } : { tone: 'error', text: `save-${result.reason}` };
		},
		open(id: string) {
			const result = store.load(id);
			if (!result.ok) {
				notice = { tone: 'error', text: `open-${result.reason}`, issues: result.issues };
				return;
			}
			replace(result.file);
			notice = null;
		},
		/** A saved draft's model, for comparison — `null` when it is missing or corrupt. */
		draftModel(id: string): ArchitectureModel | null {
			const result = store.load(id);
			return result.ok ? result.file.model : null;
		},
		deleteDraft(id: string) {
			store.remove(id);
			drafts = store.list();
		},
		/**
		 * Save the current model as the baseline (so the comparison can find it), then continue
		 * on a variant derived from it with the reason recorded.
		 */
		createVariant(name: string, reason: string) {
			const saved = store.save({ model, layout });
			if (!saved.ok) {
				notice = { tone: 'error', text: `save-${saved.reason}` };
				return;
			}
			const variant = deriveVariant(model, newModelId('variant'), name, reason);
			commit({ model: variant, layout });
			store.save({ model, layout });
			drafts = store.list();
			notice = { tone: 'success', text: 'variant-created' };
		},
		exportText(): string {
			return stringifyArchitectureFile({ model, layout });
		},
		importText(text: string): boolean {
			const parsed = parseArchitectureFile(text);
			if (!parsed.ok) {
				notice = { tone: 'error', text: 'import-invalid', issues: parsed.issues.slice(0, 8) };
				return false;
			}
			replace(parsed.file);
			notice = { tone: 'success', text: 'imported' };
			return true;
		},
		/** Load the four-stage evolution example as saved drafts and open its last stage. */
		loadEvolutionExample() {
			const stages = evolutionExample();
			for (const stage of stages) store.save({ model: stage, layout: layoutByZone(stage) });
			drafts = store.list();
			const last = stages[stages.length - 1];
			replace({ model: last, layout: layoutByZone(last) });
			notice = { tone: 'success', text: 'example-loaded' };
		},
	};
}

export type ArchitectureStudio = ReturnType<typeof createArchitectureStudio>;

const KEY = Symbol('architecture-studio');

export function provideArchitectureStudio(studio: ArchitectureStudio): ArchitectureStudio {
	setContext(KEY, studio);
	return studio;
}

export function useArchitectureStudio(): ArchitectureStudio {
	const studio = getContext<ArchitectureStudio | undefined>(KEY);
	if (!studio) throw new Error('useArchitectureStudio: no studio in context (render inside the architecture layout)');
	return studio;
}
