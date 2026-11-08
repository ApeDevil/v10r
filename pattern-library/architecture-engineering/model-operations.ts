/**
 * Pure lifecycle operations on an architecture model. Every operation returns a new model or
 * a refusal — data, never a thrown error — and leaves its input untouched, so an editor can
 * keep the previous model for undo and a refused edit changes nothing.
 *
 * The operations keep the model's integrity by construction: removing a node removes its
 * connections, a connection cannot dangle or loop, a zone in use cannot be removed, a
 * placement must be one the node kind allows. Ids are generated deterministically from the
 * kind (`app-server`, `app-server-2`, …), so the same edits produce the same model.
 */
import {
	ARCHITECTURE_MODEL_FORMAT,
	type ArchitectureConnection,
	type ArchitectureModel,
	type ArchitectureNode,
	type ArchitectureZone,
	type NodeTraits,
} from './architecture-model.ts';
import { NODE_KINDS, type NodeKind, type Placement, type Protocol, ZONE_KINDS, type ZoneKind } from './vocabulary.ts';

export type ModelRefusal =
	| 'node.unknown'
	| 'connection.unknown'
	| 'zone.unknown'
	| 'zone.in-use'
	| 'connection.self'
	| 'connection.duplicate'
	| 'placement.not-allowed'
	| 'limit.reached'
	| 'id.duplicate';

export type ModelOperation = { ok: true; model: ArchitectureModel; id?: string } | { ok: false; refusal: ModelRefusal };

const ZONE_LABELS: Record<ZoneKind, string> = {
	client: 'User device',
	application: 'Application',
	data: 'Data stores',
	'third-party': 'Third parties',
};

export function emptyTraits(): NodeTraits {
	return { holds_secrets: false, cpu_intensive: false, long_running: false, stateful: false, distinct_runtime: false };
}

/** A new, empty model with the four standard trust zones. */
export function createArchitectureModel(id: string, name: string): ArchitectureModel {
	return {
		format: ARCHITECTURE_MODEL_FORMAT,
		id,
		name,
		description: '',
		zones: ZONE_KINDS.map((kind) => ({ id: kind, label: ZONE_LABELS[kind], kind })),
		nodes: [],
		connections: [],
		constraints: [],
	};
}

/** The first free id of the form `base`, `base-2`, `base-3`, … */
export function freeModelId(base: string, taken: Iterable<string>): string {
	const used = new Set(taken);
	if (!used.has(base)) return base;
	let n = 2;
	while (used.has(`${base}-${n}`)) n++;
	return `${base}-${n}`;
}

function zoneFor(model: ArchitectureModel, kind: ZoneKind): { zones: ArchitectureZone[]; zone: string } {
	const existing = model.zones.find((zone) => zone.kind === kind);
	if (existing) return { zones: model.zones, zone: existing.id };
	const id = freeModelId(
		kind,
		model.zones.map((zone) => zone.id),
	);
	return { zones: [...model.zones, { id, label: ZONE_LABELS[kind], kind }], zone: id };
}

export interface NewNode {
	kind: NodeKind;
	label?: string;
	placement?: Placement;
	responsibilities?: string[];
	traits?: Partial<NodeTraits>;
	decisions?: string[];
	patterns?: string[];
	id?: string;
}

export function addNode(model: ArchitectureModel, input: NewNode, limit = 200): ModelOperation {
	if (model.nodes.length >= limit) return { ok: false, refusal: 'limit.reached' };
	const spec = NODE_KINDS[input.kind];
	const placement = input.placement ?? spec.placements[0];
	if (!(spec.placements as readonly Placement[]).includes(placement))
		return { ok: false, refusal: 'placement.not-allowed' };
	const taken = model.nodes.map((node) => node.id);
	if (input.id && taken.includes(input.id)) return { ok: false, refusal: 'id.duplicate' };
	const id = input.id ?? freeModelId(input.kind, taken);
	const { zones, zone } = zoneFor(model, spec.zone);
	const node: ArchitectureNode = {
		id,
		kind: input.kind,
		label: input.label ?? spec.label,
		zone,
		placement,
		responsibilities: input.responsibilities ?? [],
		traits: { ...emptyTraits(), ...input.traits },
		decisions: input.decisions ?? [],
		patterns: input.patterns ?? [...spec.patterns],
	};
	return { ok: true, model: { ...model, zones, nodes: [...model.nodes, node] }, id };
}

export type NodePatch = Partial<Omit<ArchitectureNode, 'id' | 'kind' | 'traits'>> & { traits?: Partial<NodeTraits> };

export function updateNode(model: ArchitectureModel, id: string, patch: NodePatch): ModelOperation {
	const index = model.nodes.findIndex((node) => node.id === id);
	if (index < 0) return { ok: false, refusal: 'node.unknown' };
	const current = model.nodes[index];
	const next: ArchitectureNode = { ...current, ...patch, traits: { ...current.traits, ...patch.traits } };
	if (!(NODE_KINDS[next.kind].placements as readonly Placement[]).includes(next.placement)) {
		return { ok: false, refusal: 'placement.not-allowed' };
	}
	if (!model.zones.some((zone) => zone.id === next.zone)) return { ok: false, refusal: 'zone.unknown' };
	const nodes = model.nodes.slice();
	nodes[index] = next;
	return { ok: true, model: { ...model, nodes }, id };
}

/** Removing a node removes every connection that touches it — a connection never dangles. */
export function removeNode(model: ArchitectureModel, id: string): ModelOperation {
	if (!model.nodes.some((node) => node.id === id)) return { ok: false, refusal: 'node.unknown' };
	return {
		ok: true,
		model: {
			...model,
			nodes: model.nodes.filter((node) => node.id !== id),
			connections: model.connections.filter((connection) => connection.from !== id && connection.to !== id),
		},
	};
}

/** The protocol a new connection starts with: the first one the target accepts. */
export function defaultProtocol(target: ArchitectureNode): Protocol {
	return NODE_KINDS[target.kind].accepts[0];
}

export interface NewConnection {
	from: string;
	to: string;
	protocol?: Protocol;
	data_flow?: string;
	mode?: ArchitectureConnection['mode'];
	authenticated?: ArchitectureConnection['authenticated'];
	failure_handling?: ArchitectureConnection['failure_handling'];
	id?: string;
}

export function addConnection(model: ArchitectureModel, input: NewConnection, limit = 600): ModelOperation {
	if (model.connections.length >= limit) return { ok: false, refusal: 'limit.reached' };
	const target = model.nodes.find((node) => node.id === input.to);
	if (!target || !model.nodes.some((node) => node.id === input.from)) return { ok: false, refusal: 'node.unknown' };
	if (input.from === input.to) return { ok: false, refusal: 'connection.self' };
	const protocol = input.protocol ?? defaultProtocol(target);
	if (
		model.connections.some(
			(connection) => connection.from === input.from && connection.to === input.to && connection.protocol === protocol,
		)
	) {
		return { ok: false, refusal: 'connection.duplicate' };
	}
	const taken = model.connections.map((connection) => connection.id);
	if (input.id && taken.includes(input.id)) return { ok: false, refusal: 'id.duplicate' };
	const id = input.id ?? freeModelId(`${input.from}-to-${input.to}`.slice(0, 60).replace(/-+$/, ''), taken);
	const connection: ArchitectureConnection = {
		id,
		from: input.from,
		to: input.to,
		protocol,
		mode: input.mode ?? (protocol === 'message-queue' || protocol === 'database-outbox' ? 'async' : 'sync'),
		data_flow: input.data_flow ?? '',
		authenticated: input.authenticated ?? 'unknown',
		failure_handling: input.failure_handling ?? 'unknown',
	};
	return { ok: true, model: { ...model, connections: [...model.connections, connection] }, id };
}

export type ConnectionPatch = Partial<Omit<ArchitectureConnection, 'id' | 'from' | 'to'>>;

export function updateConnection(model: ArchitectureModel, id: string, patch: ConnectionPatch): ModelOperation {
	const index = model.connections.findIndex((connection) => connection.id === id);
	if (index < 0) return { ok: false, refusal: 'connection.unknown' };
	const connections = model.connections.slice();
	connections[index] = { ...connections[index], ...patch };
	return { ok: true, model: { ...model, connections }, id };
}

export function removeConnection(model: ArchitectureModel, id: string): ModelOperation {
	if (!model.connections.some((connection) => connection.id === id))
		return { ok: false, refusal: 'connection.unknown' };
	return { ok: true, model: { ...model, connections: model.connections.filter((connection) => connection.id !== id) } };
}

export function addZone(model: ArchitectureModel, kind: ZoneKind, label: string): ModelOperation {
	if (model.zones.length >= 20) return { ok: false, refusal: 'limit.reached' };
	const id = freeModelId(
		kind,
		model.zones.map((zone) => zone.id),
	);
	return { ok: true, model: { ...model, zones: [...model.zones, { id, label, kind }] }, id };
}

export function updateZone(
	model: ArchitectureModel,
	id: string,
	patch: Partial<Omit<ArchitectureZone, 'id'>>,
): ModelOperation {
	const index = model.zones.findIndex((zone) => zone.id === id);
	if (index < 0) return { ok: false, refusal: 'zone.unknown' };
	const zones = model.zones.slice();
	zones[index] = { ...zones[index], ...patch };
	return { ok: true, model: { ...model, zones }, id };
}

export function removeZone(model: ArchitectureModel, id: string): ModelOperation {
	if (!model.zones.some((zone) => zone.id === id)) return { ok: false, refusal: 'zone.unknown' };
	if (model.nodes.some((node) => node.zone === id)) return { ok: false, refusal: 'zone.in-use' };
	return { ok: true, model: { ...model, zones: model.zones.filter((zone) => zone.id !== id) } };
}

/** Set the model's own fields (name, description, constraints, change reason). */
export function updateModelInfo(
	model: ArchitectureModel,
	patch: Partial<Pick<ArchitectureModel, 'name' | 'description' | 'constraints' | 'change_reason'>>,
): ModelOperation {
	return { ok: true, model: { ...model, ...patch } };
}

/**
 * Duplicate a model into a variant: a new id, `derived_from` pointing at the baseline, and the
 * reason for the change. Node and connection ids are kept, so a comparison can match them.
 */
export function deriveVariant(model: ArchitectureModel, id: string, name: string, reason: string): ArchitectureModel {
	return { ...structuredClone(model), id, name, derived_from: model.id, change_reason: reason };
}
