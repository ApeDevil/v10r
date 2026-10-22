/**
 * The lifecycle of a composition, as pure functions: each takes a document and returns a new
 * one, never mutating its input, so an editor's undo is a stack of snapshots and two callers
 * applying the same operations get byte-identical documents.
 *
 * A refused operation returns its input unchanged with the reason as a diagnostic. Only the
 * top-level arrangement is edited — a subassembly's inside is its definition's business — and
 * every number entering from outside (a drag, a gizmo) is quantised on the way in.
 */
import type {
	Conduit,
	Coupling,
	Frame,
	PortRef,
	ProductComposition,
	ProductDefinition,
	ProductOccurrence,
	Vec3,
} from '../schemas/product-composition';
import { type CompositionDiagnostic, compareText, type DiagnosticCode, diagnostic } from './diagnostics';
import {
	canonicalFrame,
	composeFrames,
	frameFromAxisAngle,
	framesMate,
	invertFrame,
	matedPlacement,
	quantizeVec3,
} from './frame';
import { portUse } from './network';
import { type PortResolution, resolvePort } from './resolve';
import { type PortStandardRegistry, portMismatches } from './standards';

export interface OperationResult {
	composition: ProductComposition;
	/** Empty when the operation applied; the reason when it was refused. */
	diagnostics: CompositionDiagnostic[];
}

const applied = (composition: ProductComposition): OperationResult => ({ composition, diagnostics: [] });

const refused = (
	composition: ProductComposition,
	code: DiagnosticCode,
	subject: string,
	mismatches?: Parameters<typeof diagnostic>[2],
): OperationResult => ({ composition, diagnostics: [diagnostic(code, subject, mismatches)] });

/** The first free `prefix-n`, n ≥ 1 — deterministic, so replaying operations replays ids. */
export function nextId(prefix: string, existing: Iterable<string>): string {
	const taken = new Set(existing);
	let n = 1;
	while (taken.has(`${prefix}-${n}`)) n++;
	return `${prefix}-${n}`;
}

export interface OccurrenceDraft {
	/** Generated from the definition id when absent. */
	id?: string;
	definition: string;
	placement: Frame;
	label?: string;
}

/**
 * Place a definition. One the document lacks is copied in from `catalogue`, with every
 * definition nested inside it, so the document stays self-contained.
 */
export function addOccurrence(
	composition: ProductComposition,
	draft: OccurrenceDraft,
	catalogue: readonly ProductDefinition[] = [],
): OperationResult {
	const ids = composition.occurrences.map((occurrence) => occurrence.id);
	const id = draft.id ?? nextId(draft.definition, ids);
	if (ids.includes(id)) return refused(composition, 'id.duplicate', `occurrences/${id}`);
	const added = missingDefinitions(composition, draft.definition, catalogue);
	if (!added) return refused(composition, 'definition.missing', `occurrences/${id}`);

	const occurrence: ProductOccurrence = {
		id,
		definition: draft.definition,
		placement: canonicalFrame(draft.placement),
	};
	if (draft.label !== undefined) occurrence.label = draft.label;
	return applied({
		...composition,
		definitions: [...composition.definitions, ...added],
		occurrences: [...composition.occurrences, occurrence],
	});
}

/** The definitions `id` needs that the document lacks, from the catalogue; `undefined` if one is nowhere. */
function missingDefinitions(composition: ProductComposition, id: string, catalogue: readonly ProductDefinition[]) {
	const present = new Set(composition.definitions.map((definition) => definition.id));
	const available = new Map(catalogue.map((definition) => [definition.id, definition]));
	const added: ProductDefinition[] = [];
	const pending = [id];
	while (pending.length > 0) {
		const next = pending.pop() as string;
		if (present.has(next)) continue;
		const definition = available.get(next);
		if (!definition) return undefined;
		present.add(next);
		added.push(definition);
		if (definition.body.kind === 'composition') {
			pending.push(...definition.body.occurrences.map((occurrence) => occurrence.definition));
		}
	}
	return added;
}

/** Remove an occurrence with every coupling that touches it and every conduit realising one. */
export function removeOccurrence(composition: ProductComposition, id: string): OperationResult {
	if (!composition.occurrences.some((occurrence) => occurrence.id === id)) {
		return refused(composition, 'occurrence.unresolved', `occurrences/${id}`);
	}
	const kept = composition.couplings.filter((coupling) => coupling.a.occurrence !== id && coupling.b.occurrence !== id);
	const keptIds = new Set(kept.map((coupling) => coupling.id));
	return applied({
		...composition,
		occurrences: composition.occurrences.filter((occurrence) => occurrence.id !== id),
		couplings: kept,
		conduits: composition.conduits.filter((conduit) => keptIds.has(conduit.coupling)),
	});
}

/**
 * Move an occurrence; everything mated to it, directly or through others, moves with it.
 * The cluster moves rigidly, then each mate is re-derived from the moved occurrence outward,
 * so repeated moves never accumulate drift. A mated ring is followed along a spanning tree;
 * the edge that closes it is not forced, and validation reports it if it no longer holds.
 */
export function moveOccurrence(
	composition: ProductComposition,
	registry: PortStandardRegistry,
	id: string,
	placement: Frame,
): OperationResult {
	const occurrence = composition.occurrences.find((candidate) => candidate.id === id);
	if (!occurrence) return refused(composition, 'occurrence.unresolved', `occurrences/${id}`);
	const target = canonicalFrame(placement);
	const delta = composeFrames(target, invertFrame(occurrence.placement));
	const moved = withPlacement(moveRigidly(composition, matedCluster(composition, id), delta), id, target);
	return applied(rederiveMates(moved, registry, id));
}

/** Turn an occurrence about a world axis through its own origin, carrying its mated cluster. */
export function rotateOccurrence(
	composition: ProductComposition,
	registry: PortStandardRegistry,
	id: string,
	axis: Vec3,
	radians: number,
): OperationResult {
	const occurrence = composition.occurrences.find((candidate) => candidate.id === id);
	if (!occurrence) return refused(composition, 'occurrence.unresolved', `occurrences/${id}`);
	const turn = frameFromAxisAngle([0, 0, 0], axis, radians);
	const { rotation } = composeFrames(turn, { position: [0, 0, 0], rotation: occurrence.placement.rotation });
	return moveOccurrence(composition, registry, id, { position: occurrence.placement.position, rotation });
}

export interface CouplingDraft {
	/** Generated when absent. */
	id?: string;
	a: PortRef;
	b: PortRef;
	mode: Coupling['mode'];
}

/**
 * Couple two top-level ports, refusing what validation would report. A new mate snaps `b`'s
 * whole cluster onto `a`; a mate between two products already in one cluster is accepted only
 * when it already holds — closing a ring never drags the ring out of shape.
 */
export function connect(
	composition: ProductComposition,
	registry: PortStandardRegistry,
	draft: CouplingDraft,
): OperationResult {
	const id =
		draft.id ??
		nextId(
			'coupling',
			composition.couplings.map((coupling) => coupling.id),
		);
	const subject = `couplings/${id}`;
	if (composition.couplings.some((coupling) => coupling.id === id))
		return refused(composition, 'id.duplicate', subject);
	if (draft.a.occurrence === draft.b.occurrence) return refused(composition, 'coupling.self', subject);

	const a = resolvePort(composition, draft.a);
	const b = resolvePort(composition, draft.b);
	if (!a || !b) return refused(composition, 'coupling.unresolved', subject);
	if (joinsSamePair(composition, a, b)) return refused(composition, 'coupling.duplicate', subject);
	const mismatches = portMismatches(registry, a.port, b.port, draft.mode);
	if (mismatches.length > 0) return refused(composition, 'port.incompatible', subject, mismatches);

	const use = portUse(composition);
	for (const end of [a, b]) {
		const used = use.get(end.key);
		const full =
			draft.mode === 'mated' ? used !== undefined : used && (used.mated || used.count >= (end.port.capacity ?? 1));
		if (full) return refused(composition, 'port.capacity', `ports/${end.key}`);
	}

	const coupling: Coupling = { id, a: draft.a, b: draft.b, mode: draft.mode };
	if (draft.mode === 'conduit') return applied({ ...composition, couplings: [...composition.couplings, coupling] });

	const clocking = registry.get(a.port.standard)?.clocking ?? 'fixed';
	const cluster = matedCluster(composition, draft.a.occurrence);
	if (cluster.has(draft.b.occurrence)) {
		if (!framesMate(a.frame, b.frame, clocking)) return refused(composition, 'mate.misaligned', subject);
		return applied({ ...composition, couplings: [...composition.couplings, coupling] });
	}

	const moving = composition.occurrences.find(
		(occurrence) => occurrence.id === draft.b.occurrence,
	) as ProductOccurrence;
	const localPort = composeFrames(invertFrame(moving.placement), b.frame);
	const snapped = matedPlacement(a.frame, localPort, clocking === 'free' ? moving.placement : undefined);
	const delta = composeFrames(snapped, invertFrame(moving.placement));
	const moved = withPlacement(
		moveRigidly(composition, matedCluster(composition, moving.id), delta),
		moving.id,
		snapped,
	);
	return applied(rederiveMates({ ...moved, couplings: [...moved.couplings, coupling] }, registry, draft.a.occurrence));
}

/** Remove a coupling and the conduit realising it. */
export function disconnect(composition: ProductComposition, couplingId: string): OperationResult {
	if (!composition.couplings.some((coupling) => coupling.id === couplingId)) {
		return refused(composition, 'coupling.unresolved', `couplings/${couplingId}`);
	}
	return applied({
		...composition,
		couplings: composition.couplings.filter((coupling) => coupling.id !== couplingId),
		conduits: composition.conduits.filter((conduit) => conduit.coupling !== couplingId),
	});
}

/** Set the interior waypoints (world space) of a conduit coupling's path, creating its conduit if needed. */
export function setConduitWaypoints(
	composition: ProductComposition,
	couplingId: string,
	waypoints: readonly Vec3[],
): OperationResult {
	const coupling = composition.couplings.find((candidate) => candidate.id === couplingId);
	if (!coupling) return refused(composition, 'coupling.unresolved', `couplings/${couplingId}`);
	if (coupling.mode === 'mated') return refused(composition, 'conduit.mode', `couplings/${couplingId}`);

	const points = waypoints.map(quantizeVec3);
	const existing = composition.conduits.find((conduit) => conduit.coupling === couplingId);
	const conduits: Conduit[] = existing
		? composition.conduits.map((conduit) => (conduit === existing ? { ...conduit, waypoints: points } : conduit))
		: [
				...composition.conduits,
				{
					id: nextId(
						'conduit',
						composition.conduits.map((conduit) => conduit.id),
					),
					coupling: couplingId,
					waypoints: points,
				},
			];
	return applied({ ...composition, conduits });
}

/** Insert a waypoint before `index` (`index` = length appends). */
export function insertWaypoint(
	composition: ProductComposition,
	conduitId: string,
	index: number,
	point: Vec3,
): OperationResult {
	return editWaypoints(composition, conduitId, index, (waypoints) =>
		index >= 0 && index <= waypoints.length
			? [...waypoints.slice(0, index), quantizeVec3(point), ...waypoints.slice(index)]
			: undefined,
	);
}

export function removeWaypoint(composition: ProductComposition, conduitId: string, index: number): OperationResult {
	return editWaypoints(composition, conduitId, index, (waypoints) =>
		index >= 0 && index < waypoints.length ? waypoints.filter((_, at) => at !== index) : undefined,
	);
}

function editWaypoints(
	composition: ProductComposition,
	conduitId: string,
	index: number,
	edit: (waypoints: Vec3[]) => Vec3[] | undefined,
): OperationResult {
	const conduit = composition.conduits.find((candidate) => candidate.id === conduitId);
	if (!conduit) return refused(composition, 'conduit.unresolved', `conduits/${conduitId}`);
	const waypoints = edit(conduit.waypoints);
	if (!waypoints) return refused(composition, 'waypoint.unresolved', `conduits/${conduitId}/waypoints/${index}`);
	return applied({
		...composition,
		conduits: composition.conduits.map((candidate) => (candidate === conduit ? { ...conduit, waypoints } : candidate)),
	});
}

/** Whether a top-level coupling already joins these two leaf ports. */
function joinsSamePair(composition: ProductComposition, a: PortResolution, b: PortResolution): boolean {
	const pair = [a.key, b.key].sort(compareText).join(' ');
	return composition.couplings.some((coupling) => {
		const left = resolvePort(composition, coupling.a);
		const right = resolvePort(composition, coupling.b);
		return left && right && [left.key, right.key].sort(compareText).join(' ') === pair;
	});
}

/** Top-level mates, by occurrence: each entry is this side's port and the other side's. */
function matesByOccurrence(composition: ProductComposition) {
	const mates = new Map<string, { own: PortRef; other: PortRef }[]>();
	for (const coupling of composition.couplings) {
		if (coupling.mode !== 'mated') continue;
		for (const [own, other] of [
			[coupling.a, coupling.b],
			[coupling.b, coupling.a],
		]) {
			mates.set(own.occurrence, [...(mates.get(own.occurrence) ?? []), { own, other }]);
		}
	}
	return mates;
}

/** The occurrences rigidly joined to `id` through mates, `id` included. */
function matedCluster(composition: ProductComposition, id: string): Set<string> {
	const mates = matesByOccurrence(composition);
	const cluster = new Set([id]);
	const pending = [id];
	while (pending.length > 0) {
		for (const { other } of mates.get(pending.pop() as string) ?? []) {
			if (!cluster.has(other.occurrence)) {
				cluster.add(other.occurrence);
				pending.push(other.occurrence);
			}
		}
	}
	return cluster;
}

function moveRigidly(composition: ProductComposition, members: Set<string>, delta: Frame): ProductComposition {
	return {
		...composition,
		occurrences: composition.occurrences.map((occurrence) =>
			members.has(occurrence.id)
				? { ...occurrence, placement: composeFrames(delta, occurrence.placement) }
				: occurrence,
		),
	};
}

function withPlacement(composition: ProductComposition, id: string, placement: Frame): ProductComposition {
	return {
		...composition,
		occurrences: composition.occurrences.map((occurrence) =>
			occurrence.id === id ? { ...occurrence, placement } : occurrence,
		),
	};
}

/** Re-snap every mate along a breadth-first spanning tree from `root`, which stays where it is. */
function rederiveMates(composition: ProductComposition, registry: PortStandardRegistry, root: string) {
	const mates = matesByOccurrence(composition);
	let current = composition;
	const placed = new Set([root]);
	const queue = [root];
	while (queue.length > 0) {
		for (const { own, other } of mates.get(queue.shift() as string) ?? []) {
			if (placed.has(other.occurrence)) continue;
			placed.add(other.occurrence);
			queue.push(other.occurrence);
			const anchor = resolvePort(current, own);
			const follower = resolvePort(current, other);
			const occurrence = current.occurrences.find((candidate) => candidate.id === other.occurrence);
			if (!anchor || !follower || !occurrence) continue;
			const localPort = composeFrames(invertFrame(occurrence.placement), follower.frame);
			const free = registry.get(follower.port.standard)?.clocking === 'free';
			const placement = matedPlacement(anchor.frame, localPort, free ? occurrence.placement : undefined);
			current = withPlacement(current, occurrence.id, placement);
		}
	}
	return current;
}
