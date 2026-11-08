/**
 * The architecture model: typed nodes, their placement and responsibilities, the connections
 * between them, the trust zones they sit in, and the decisions and patterns they link to.
 *
 * A diagram is a projection of this model, never its storage: coordinates live in a separate
 * `ArchitectureLayout` keyed by node id, so validators, docs and MCP tools read the model
 * without any knowledge of the canvas (the C4 / Structurizr model-vs-view split).
 *
 * Reading is fail-closed and treats input as untrusted (an imported file, a pasted draft, an
 * MCP argument): strict objects (an unknown key is refused, not dropped), bounded sizes,
 * kebab-case ids, closed vocabularies, no duplicate ids and no dangling references. Nothing
 * in a model is ever executed or rendered as markup. Writing is canonical — keyed collections
 * sorted by id, object keys sorted, tab-indented — so an export → import → export round trip
 * is byte-equal and two models diff cleanly.
 *
 * Not `version` (an optimistic-concurrency counter) nor `revision` (a stored snapshot):
 * `format` is the persisted shape number, as in `#lib/schemas/product-composition.ts`.
 */
import {
	NODE_KINDS,
	type NodeKind,
	PLACEMENTS,
	type Placement,
	PROTOCOLS,
	type Protocol,
	ZONE_KINDS,
	type ZoneKind,
} from './vocabulary.ts';

export const ARCHITECTURE_MODEL_FORMAT = 1;

/** Bounds on untrusted input. A model past them is refused, not truncated. */
export const MODEL_LIMITS = {
	nodes: 200,
	connections: 600,
	zones: 20,
	constraints: 50,
	listItems: 30,
	text: 2000,
	label: 120,
	/** Bytes of JSON text an import may be. */
	fileBytes: 1_000_000,
} as const;

export const AUTHENTICATION_STATES = ['yes', 'no', 'unknown'] as const;
export type AuthenticationState = (typeof AUTHENTICATION_STATES)[number];

export const FAILURE_HANDLING = [
	'unknown',
	'none',
	'timeout',
	'retry',
	'timeout-and-retry',
	'queue-redelivery',
] as const;
export type FailureHandling = (typeof FAILURE_HANDLING)[number];

export const CONNECTION_MODES = ['sync', 'async'] as const;
export type ConnectionMode = (typeof CONNECTION_MODES)[number];

export interface NodeTraits {
	/** The node's code or configuration holds credentials, keys or other server-only secrets. */
	holds_secrets: boolean;
	/** Moderate or heavy CPU per unit of work. */
	cpu_intensive: boolean;
	/** One unit of work runs for longer than a request should (seconds to hours). */
	long_running: boolean;
	/** The node keeps state between requests (connections, in-memory data). */
	stateful: boolean;
	/** The node needs a different runtime or language than the app (Rust, native code). */
	distinct_runtime: boolean;
}

export const NODE_TRAIT_IDS = [
	'holds_secrets',
	'cpu_intensive',
	'long_running',
	'stateful',
	'distinct_runtime',
] as const;

export interface ArchitectureZone {
	id: string;
	label: string;
	kind: ZoneKind;
}

export interface ArchitectureNode {
	id: string;
	kind: NodeKind;
	label: string;
	zone: string;
	placement: Placement;
	responsibilities: string[];
	traits: NodeTraits;
	/** Decision ids from the catalogue this node implements. */
	decisions: string[];
	/** Registry pattern ids that show how to build it. */
	patterns: string[];
}

export interface ArchitectureConnection {
	id: string;
	from: string;
	to: string;
	protocol: Protocol;
	mode: ConnectionMode;
	/** What flows, in words: "upload metadata", "rendered page". */
	data_flow: string;
	authenticated: AuthenticationState;
	failure_handling: FailureHandling;
}

export interface ArchitectureModel {
	format: typeof ARCHITECTURE_MODEL_FORMAT;
	id: string;
	name: string;
	description: string;
	/** The model this one was duplicated from, when it is a variant. */
	derived_from?: string;
	/** Why the variant exists — the evolution record. */
	change_reason?: string;
	zones: ArchitectureZone[];
	nodes: ArchitectureNode[];
	connections: ArchitectureConnection[];
	constraints: string[];
}

export interface ArchitectureLayout {
	format: typeof ARCHITECTURE_MODEL_FORMAT;
	positions: Record<string, { x: number; y: number }>;
}

/** What an exported file holds: the model, and optionally its layout. */
export interface ArchitectureFile {
	model: ArchitectureModel;
	layout?: ArchitectureLayout;
}

export interface ModelIssue {
	/** Dotted location: `nodes.3.zone`. */
	path: string;
	message: string;
}

export type ModelParse = { ok: true; model: ArchitectureModel } | { ok: false; issues: ModelIssue[] };

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ID = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Reader {
	issues: ModelIssue[] = [];

	fail(path: string, message: string): void {
		this.issues.push({ path, message });
	}

	strict(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []) {
		if (!isRecord(value)) {
			this.fail(path, 'must be an object');
			return null;
		}
		for (const key of Object.keys(value)) {
			if (!required.includes(key) && !optional.includes(key)) this.fail(join(path, key), 'unknown key');
		}
		for (const key of required) {
			if (!(key in value)) this.fail(join(path, key), 'is required');
		}
		return value;
	}

	id(value: unknown, path: string): string {
		if (typeof value !== 'string' || value.length > MAX_ID || !ID.test(value)) {
			this.fail(path, 'must be a kebab-case id of at most 64 characters');
			return '';
		}
		return value;
	}

	text(value: unknown, path: string, max: number = MODEL_LIMITS.text, allowEmpty = true): string {
		if (typeof value !== 'string') {
			this.fail(path, 'must be a string');
			return '';
		}
		if (value.length > max) this.fail(path, `must be at most ${max} characters`);
		if (!allowEmpty && value.trim().length === 0) this.fail(path, 'must not be empty');
		return value;
	}

	pick<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
		if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
			this.fail(path, `must be one of ${allowed.join('|')}`);
			return allowed[0];
		}
		return value as T;
	}

	list<T>(value: unknown, path: string, max: number, item: (entry: unknown, path: string) => T): T[] {
		if (!Array.isArray(value)) {
			this.fail(path, 'must be an array');
			return [];
		}
		if (value.length > max) {
			this.fail(path, `must have at most ${max} entries`);
			return [];
		}
		return value.map((entry, index) => item(entry, join(path, String(index))));
	}

	bool(value: unknown, path: string): boolean {
		if (typeof value !== 'boolean') this.fail(path, 'must be true or false');
		return value === true;
	}
}

function join(path: string, key: string): string {
	return path ? `${path}.${key}` : key;
}

function readZone(reader: Reader, value: unknown, path: string): ArchitectureZone {
	const record = reader.strict(value, path, ['id', 'label', 'kind']);
	if (!record) return { id: '', label: '', kind: 'client' };
	return {
		id: reader.id(record.id, join(path, 'id')),
		label: reader.text(record.label, join(path, 'label'), MODEL_LIMITS.label, false),
		kind: reader.pick(record.kind, join(path, 'kind'), ZONE_KINDS),
	};
}

function readTraits(reader: Reader, value: unknown, path: string): NodeTraits {
	const record = reader.strict(value, path, NODE_TRAIT_IDS);
	const traits = {} as NodeTraits;
	for (const trait of NODE_TRAIT_IDS) traits[trait] = record ? reader.bool(record[trait], join(path, trait)) : false;
	return traits;
}

function readNode(reader: Reader, value: unknown, path: string): ArchitectureNode {
	const record = reader.strict(value, path, [
		'id',
		'kind',
		'label',
		'zone',
		'placement',
		'responsibilities',
		'traits',
		'decisions',
		'patterns',
	]);
	if (!record) return emptyNode();
	const kind = reader.pick(record.kind, join(path, 'kind'), Object.keys(NODE_KINDS) as NodeKind[]);
	const placement = reader.pick(record.placement, join(path, 'placement'), PLACEMENTS);
	const textItem = (entry: unknown, at: string) => reader.text(entry, at, MODEL_LIMITS.text, false);
	return {
		id: reader.id(record.id, join(path, 'id')),
		kind,
		label: reader.text(record.label, join(path, 'label'), MODEL_LIMITS.label, false),
		zone: reader.id(record.zone, join(path, 'zone')),
		placement,
		responsibilities: reader.list(
			record.responsibilities,
			join(path, 'responsibilities'),
			MODEL_LIMITS.listItems,
			textItem,
		),
		traits: readTraits(reader, record.traits, join(path, 'traits')),
		decisions: reader.list(record.decisions, join(path, 'decisions'), MODEL_LIMITS.listItems, (entry, at) =>
			reader.id(entry, at),
		),
		patterns: reader.list(record.patterns, join(path, 'patterns'), MODEL_LIMITS.listItems, (entry, at) =>
			reader.id(entry, at),
		),
	};
}

function readConnection(reader: Reader, value: unknown, path: string): ArchitectureConnection {
	const record = reader.strict(value, path, [
		'id',
		'from',
		'to',
		'protocol',
		'mode',
		'data_flow',
		'authenticated',
		'failure_handling',
	]);
	if (!record) return emptyConnection();
	return {
		id: reader.id(record.id, join(path, 'id')),
		from: reader.id(record.from, join(path, 'from')),
		to: reader.id(record.to, join(path, 'to')),
		protocol: reader.pick(record.protocol, join(path, 'protocol'), PROTOCOLS),
		mode: reader.pick(record.mode, join(path, 'mode'), CONNECTION_MODES),
		data_flow: reader.text(record.data_flow, join(path, 'data_flow')),
		authenticated: reader.pick(record.authenticated, join(path, 'authenticated'), AUTHENTICATION_STATES),
		failure_handling: reader.pick(record.failure_handling, join(path, 'failure_handling'), FAILURE_HANDLING),
	};
}

function emptyNode(): ArchitectureNode {
	return {
		id: '',
		kind: 'app-server',
		label: '',
		zone: '',
		placement: 'server-request',
		responsibilities: [],
		traits: {
			holds_secrets: false,
			cpu_intensive: false,
			long_running: false,
			stateful: false,
			distinct_runtime: false,
		},
		decisions: [],
		patterns: [],
	};
}

function emptyConnection(): ArchitectureConnection {
	return {
		id: '',
		from: '',
		to: '',
		protocol: 'http-rest',
		mode: 'sync',
		data_flow: '',
		authenticated: 'unknown',
		failure_handling: 'unknown',
	};
}

/** Graph integrity: ids unique per collection, every reference resolves, placement allowed for the kind. */
function checkIntegrity(model: ArchitectureModel, reader: Reader): void {
	const unique = (collection: string, items: { id: string }[]) => {
		const seen = new Set<string>();
		items.forEach((item, index) => {
			if (item.id && seen.has(item.id)) reader.fail(`${collection}.${index}.id`, `duplicate id "${item.id}"`);
			seen.add(item.id);
		});
		return seen;
	};
	const zoneIds = unique('zones', model.zones);
	const nodeIds = unique('nodes', model.nodes);
	unique('connections', model.connections);
	model.nodes.forEach((node, index) => {
		if (node.zone && !zoneIds.has(node.zone)) reader.fail(`nodes.${index}.zone`, `zone "${node.zone}" does not exist`);
		const allowed = NODE_KINDS[node.kind].placements as readonly Placement[];
		if (!allowed.includes(node.placement)) {
			reader.fail(`nodes.${index}.placement`, `a ${node.kind} cannot run as ${node.placement}`);
		}
	});
	model.connections.forEach((connection, index) => {
		for (const end of ['from', 'to'] as const) {
			if (connection[end] && !nodeIds.has(connection[end])) {
				reader.fail(`connections.${index}.${end}`, `node "${connection[end]}" does not exist`);
			}
		}
		if (connection.from && connection.from === connection.to) {
			reader.fail(`connections.${index}`, 'a connection cannot join a node to itself');
		}
	});
}

export function parseArchitectureModel(input: unknown): ModelParse {
	const reader = new Reader();
	const record = reader.strict(
		input,
		'',
		['format', 'id', 'name', 'description', 'zones', 'nodes', 'connections', 'constraints'],
		['derived_from', 'change_reason'],
	);
	if (!record) return { ok: false, issues: reader.issues };
	if (record.format !== ARCHITECTURE_MODEL_FORMAT) {
		return {
			ok: false,
			issues: [
				{
					path: 'format',
					message: `unsupported format ${String(record.format)} (this version reads ${ARCHITECTURE_MODEL_FORMAT})`,
				},
			],
		};
	}
	const model: ArchitectureModel = {
		format: ARCHITECTURE_MODEL_FORMAT,
		id: reader.id(record.id, 'id'),
		name: reader.text(record.name, 'name', MODEL_LIMITS.label, false),
		description: reader.text(record.description, 'description'),
		zones: reader.list(record.zones, 'zones', MODEL_LIMITS.zones, (entry, at) => readZone(reader, entry, at)),
		nodes: reader.list(record.nodes, 'nodes', MODEL_LIMITS.nodes, (entry, at) => readNode(reader, entry, at)),
		connections: reader.list(record.connections, 'connections', MODEL_LIMITS.connections, (entry, at) =>
			readConnection(reader, entry, at),
		),
		constraints: reader.list(record.constraints, 'constraints', MODEL_LIMITS.constraints, (entry, at) =>
			reader.text(entry, at, MODEL_LIMITS.text, false),
		),
	};
	if (record.derived_from !== undefined) model.derived_from = reader.id(record.derived_from, 'derived_from');
	if (record.change_reason !== undefined) model.change_reason = reader.text(record.change_reason, 'change_reason');
	if (reader.issues.length === 0) checkIntegrity(model, reader);
	return reader.issues.length > 0 ? { ok: false, issues: reader.issues } : { ok: true, model };
}

export type LayoutParse = { ok: true; layout: ArchitectureLayout } | { ok: false; issues: ModelIssue[] };

/** Layout positions for unknown nodes are dropped (a layout is cosmetic); malformed positions are refused. */
export function parseArchitectureLayout(input: unknown, model: ArchitectureModel): LayoutParse {
	const reader = new Reader();
	const record = reader.strict(input, '', ['format', 'positions']);
	if (!record) return { ok: false, issues: reader.issues };
	if (record.format !== ARCHITECTURE_MODEL_FORMAT)
		return { ok: false, issues: [{ path: 'format', message: 'unsupported format' }] };
	if (!isRecord(record.positions)) return { ok: false, issues: [{ path: 'positions', message: 'must be an object' }] };
	const nodeIds = new Set(model.nodes.map((node) => node.id));
	const positions: ArchitectureLayout['positions'] = {};
	for (const [id, value] of Object.entries(record.positions)) {
		const position = reader.strict(value, `positions.${id}`, ['x', 'y']);
		if (!position) continue;
		const { x, y } = position;
		if (
			typeof x !== 'number' ||
			typeof y !== 'number' ||
			!Number.isFinite(x) ||
			!Number.isFinite(y) ||
			Math.abs(x) > 1e6 ||
			Math.abs(y) > 1e6
		) {
			reader.fail(`positions.${id}`, 'x and y must be finite numbers within ±1e6');
			continue;
		}
		if (nodeIds.has(id)) positions[id] = { x, y };
	}
	return reader.issues.length > 0
		? { ok: false, issues: reader.issues }
		: { ok: true, layout: { format: ARCHITECTURE_MODEL_FORMAT, positions } };
}

export type FileParse = { ok: true; file: ArchitectureFile } | { ok: false; issues: ModelIssue[] };

/** Read an exported file's text: size-bounded, JSON, then model, then (optional) layout. */
export function parseArchitectureFile(text: string): FileParse {
	if (text.length > MODEL_LIMITS.fileBytes) {
		return { ok: false, issues: [{ path: '', message: `file is larger than ${MODEL_LIMITS.fileBytes} characters` }] };
	}
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, issues: [{ path: '', message: 'not valid JSON' }] };
	}
	if (!isRecord(data)) return { ok: false, issues: [{ path: '', message: 'must be an object with a "model"' }] };
	for (const key of Object.keys(data)) {
		if (key !== 'model' && key !== 'layout') return { ok: false, issues: [{ path: key, message: 'unknown key' }] };
	}
	const model = parseArchitectureModel(data.model);
	if (!model.ok)
		return { ok: false, issues: model.issues.map((issue) => ({ ...issue, path: join('model', issue.path) })) };
	if (data.layout === undefined) return { ok: true, file: { model: model.model } };
	const layout = parseArchitectureLayout(data.layout, model.model);
	if (!layout.ok)
		return { ok: false, issues: layout.issues.map((issue) => ({ ...issue, path: join('layout', issue.path) })) };
	return { ok: true, file: { model: model.model, layout: layout.layout } };
}

const KEYED = new Set(['zones', 'nodes', 'connections']);

function canonical(value: unknown, key?: string): unknown {
	if (Array.isArray(value)) {
		const items = value.map((item) => canonical(item));
		if (key && KEYED.has(key)) {
			return (items as { id: string }[]).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
		}
		return items;
	}
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((entry) => [entry, canonical(value[entry], entry)]),
		);
	}
	return value;
}

/** Canonical, byte-stable text of a file: the same content always produces the same bytes. */
export function stringifyArchitectureFile(file: ArchitectureFile): string {
	return `${JSON.stringify(canonical(file), null, '\t')}\n`;
}
