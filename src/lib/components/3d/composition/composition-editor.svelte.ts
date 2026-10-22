/**
 * Editing state for one composition: the document, what is selected, and an undo stack.
 *
 * Every change goes through a pure core operation (`$lib/product-composition`), so the
 * editor never mutates a document — undo is a stack of earlier snapshots. A refused
 * operation leaves the document alone and keeps its reasons in `notice` for the UI to say.
 * A drag is one *gesture*: every frame re-applies the operation to the snapshot the drag
 * started from (never to the previous frame), and the whole drag is one undo step.
 */
import {
	CONDUIT_STUB,
	type CompositionDiagnostic,
	type CompositionIssue,
	type Coupling,
	connect,
	frameAxis,
	type OperationResult,
	type PortRef,
	type PortStandardRegistry,
	type ProductComposition,
	parseComposition,
	resolveComposition,
	resolvePort,
	stringifyComposition,
	type Vec3,
} from '$lib/product-composition';
import type { CompositionSelection } from './CompositionScene.svelte';

/** Snapshots kept for undo. */
const HISTORY_LIMIT = 100;

/** How another port reads against the selected one: it would couple, or it would be refused (and why). */
export interface CouplingOption {
	key: string;
	ref: PortRef;
	diagnostics: CompositionDiagnostic[];
}

export class CompositionEditor {
	composition = $state.raw() as ProductComposition;
	selection = $state<CompositionSelection>(null);
	/** Index of the selected waypoint while a conduit is selected. */
	waypoint = $state<number | undefined>(undefined);
	coupleMode = $state<Coupling['mode']>('conduit');
	/** Why the last operation was refused; empty after one that applied. */
	notice = $state.raw<CompositionDiagnostic[]>([]);
	#history = $state.raw<ProductComposition[]>([]);
	#gestureBase: ProductComposition | undefined;

	readonly registry: PortStandardRegistry;

	constructor(composition: ProductComposition, registry: PortStandardRegistry) {
		this.composition = composition;
		this.registry = registry;
	}

	get canUndo(): boolean {
		return this.#history.length > 0;
	}

	/** Apply an operation's result. Returns whether it applied. */
	apply(result: OperationResult): boolean {
		if (result.diagnostics.length > 0) {
			this.notice = result.diagnostics;
			return false;
		}
		this.#record(this.composition);
		this.composition = result.composition;
		this.notice = [];
		return true;
	}

	undo() {
		const previous = this.#history.at(-1);
		if (!previous) return;
		this.#history = this.#history.slice(0, -1);
		this.composition = previous;
		this.notice = [];
		this.waypoint = undefined;
	}

	select(selection: CompositionSelection) {
		this.selection = selection;
		this.waypoint = undefined;
		this.notice = [];
	}

	/** Start a drag. Until `endGesture`, `gestureBase` is the document as it was when the drag began. */
	beginGesture() {
		this.#gestureBase = this.composition;
	}

	get gestureBase(): ProductComposition {
		return this.#gestureBase ?? this.composition;
	}

	/** Show one frame of a drag: an operation applied to `gestureBase`. A refused frame is skipped. */
	updateGesture(result: OperationResult) {
		if (result.diagnostics.length === 0) this.composition = result.composition;
	}

	/** End a drag: one undo step for the whole movement, none if nothing moved. */
	endGesture() {
		const base = this.#gestureBase;
		this.#gestureBase = undefined;
		if (base && base !== this.composition) this.#record(base);
	}

	/** Every other top-level port, dry-run against the selected one with the current couple mode. */
	couplingOptions(): CouplingOption[] {
		const selected = this.selection?.kind === 'port' ? this.selection : undefined;
		if (!selected?.ref) return [];
		const from = selected.ref;
		return resolveComposition(this.composition).ports.flatMap((port) => {
			if (!port.ref || port.key === selected.key) return [];
			const result = connect(this.composition, this.registry, { a: from, b: port.ref, mode: this.coupleMode });
			return [{ key: port.key, ref: port.ref, diagnostics: result.diagnostics }];
		});
	}

	/**
	 * Where "add waypoint" puts one: halfway along the run after the selected waypoint, or along
	 * the longest run when none is selected. Runs go stub to stub, so a new waypoint never lands
	 * on the straight lead-out from a port.
	 */
	waypointInsertion(coupling: string): { index: number; point: Vec3 } | undefined {
		const link = this.composition.couplings.find((candidate) => candidate.id === coupling);
		const a = link && resolvePort(this.composition, link.a);
		const b = link && resolvePort(this.composition, link.b);
		if (!a || !b) return undefined;
		const stub = (frame: typeof a.frame): Vec3 => {
			const axis = frameAxis(frame);
			return [0, 1, 2].map((i) => frame.position[i] + axis[i] * CONDUIT_STUB) as Vec3;
		};
		const waypoints = this.composition.conduits.find((conduit) => conduit.coupling === coupling)?.waypoints ?? [];
		const chain = [stub(a.frame), ...waypoints, stub(b.frame)];
		const run = (index: number) => Math.hypot(...[0, 1, 2].map((i) => chain[index + 1][i] - chain[index][i]));
		let index = this.waypoint !== undefined ? this.waypoint + 1 : 0;
		if (this.waypoint === undefined) {
			for (let candidate = 1; candidate < chain.length - 1; candidate++)
				if (run(candidate) > run(index)) index = candidate;
		}
		const point = [0, 1, 2].map((i) => (chain[index][i] + chain[index + 1][i]) / 2) as Vec3;
		return { index, point };
	}

	exportJson(): string {
		return stringifyComposition(this.composition);
	}

	/** Replace the document with a file's, as one undoable step. A file that does not parse changes nothing. */
	importJson(text: string): CompositionIssue[] {
		let data: unknown;
		try {
			data = JSON.parse(text);
		} catch (error) {
			return [{ path: '', message: error instanceof Error ? error.message : String(error) }];
		}
		const parsed = parseComposition(data);
		if (!parsed.ok) return parsed.issues;
		this.#record(this.composition);
		this.composition = parsed.composition;
		this.select(null);
		return [];
	}

	#record(snapshot: ProductComposition) {
		this.#history = [...this.#history.slice(-(HISTORY_LIMIT - 1)), snapshot];
	}
}
