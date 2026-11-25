/**
 * The surface policy — the structural rules a batch of A2UI v1.0 messages must meet before
 * anything renders it. web_core validates each component against its catalog schema; this
 * module checks what a per-component schema cannot see: the batch as a whole (size, message
 * kinds, one surface), the merged component graph (root, missing children, cycles, depth,
 * count, nodes rendered) and every value inside it (string length, URL schemes, data-binding paths, reserved
 * keys, function calls).
 *
 * Framework-free and web_core-free, so the server compiler and the renderer run the same
 * check: the server before a payload reaches a stream, the renderer before it reaches the
 * message processor. Either door alone would leave the other's input unchecked — a fixture,
 * a replayed stream or a future transport.
 *
 * Incremental by design: a surface arrives as several batches (create, then updates), so the
 * check takes the graph the previous batches built and returns the merged one.
 */
import { GENERATIVE_UI_CATALOG_ID, GENERATIVE_UI_PROTOCOL_VERSION, isGenerativeUiComponent } from './catalog.ts';
import { GENERATIVE_SURFACE_LIMITS as LIMITS } from './limits.ts';

export type GenerativeSurfaceRefusalCode =
	| 'not_a_batch'
	| 'too_many_messages'
	| 'batch_too_large'
	| 'unknown_message'
	| 'wrong_version'
	| 'bad_surface_id'
	| 'foreign_surface'
	| 'surface_not_created'
	| 'surface_exists'
	| 'unknown_catalog'
	| 'unknown_component'
	| 'bad_component_id'
	| 'duplicate_component'
	| 'too_many_components'
	| 'too_many_children'
	| 'template_children'
	| 'missing_root'
	| 'missing_child'
	| 'cyclic_reference'
	| 'too_deep'
	/** The tree root would render, counting a shared or repeated reference once per use. */
	| 'too_many_rendered_nodes'
	| 'string_too_long'
	| 'unsafe_url'
	| 'reserved_key'
	| 'value_too_deep'
	| 'bad_binding_path'
	| 'function_call'
	| 'bad_action'
	| 'data_model_too_large'
	/** A Chart whose data a chart from zero cannot draw honestly (see `inspectChart`). */
	| 'bad_chart'
	/** A component the catalog's JSON Schema rejects (reported by web_core or `@a2ui/agent`). */
	| 'catalog_violation';

export interface GenerativeSurfaceRefusal {
	code: GenerativeSurfaceRefusalCode;
	/** Where in the batch, as a JSON-pointer-like trail (`/1/updateComponents/components/3`). */
	at: string;
	message: string;
}

/** One component as the graph keeps it: its type and the ids it references. */
interface GraphNode {
	type: string;
	children: readonly string[];
}

/**
 * What the batches so far have built — enough to check the next batch against the whole
 * surface without re-reading earlier messages. Immutable: a check returns a new one.
 */
export interface GenerativeSurfaceGraph {
	readonly surfaceId: string | null;
	readonly components: ReadonlyMap<string, GraphNode>;
	/** Serialized bytes per data model path written so far. */
	readonly dataModelWrites: ReadonlyMap<string, number>;
}

export const EMPTY_GENERATIVE_SURFACE_GRAPH: GenerativeSurfaceGraph = Object.freeze({
	surfaceId: null,
	components: new Map(),
	dataModelWrites: new Map(),
});

export interface GenerativeSurfacePolicyOptions {
	/** The graph previous batches produced. Defaults to an empty surface. */
	previous?: GenerativeSurfaceGraph;
	/** Require this surface id (the server compiles for one surface). */
	surfaceId?: string;
	/**
	 * The batch is final: `root` must exist and every referenced child must be defined. The
	 * server compiles complete batches; a streaming renderer may see a child before its
	 * definition arrives, and renders a placeholder meanwhile.
	 */
	complete?: boolean;
}

export type GenerativeSurfacePolicyResult =
	| { ok: true; graph: GenerativeSurfaceGraph }
	| { ok: false; refusals: GenerativeSurfaceRefusal[] };

const SURFACE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const COMPONENT_ID = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
/** Keys that would reach a prototype if a consumer ever assigned them onto an object. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Envelope keys web_core accepts on every component, beside the catalog's own properties. */
const ENVELOPE_KEYS = new Set(['id', 'component', 'catalogId', 'accessibility']);
const MESSAGE_KINDS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const;
const CREATE_SURFACE_KEYS = new Set(['surfaceId', 'catalogId', 'components', 'dataModel', 'sendDataModel']);

/**
 * A scheme that executes, embeds or reads locally. Checked after removing whitespace and
 * control characters, which browsers ignore inside a scheme (`java\tscript:`).
 */
const UNSAFE_SCHEME_PREFIX = /^(?:javascript|vbscript|data|file|blob):/i;
const UNSAFE_SCHEME_INSIDE = /(?:javascript|vbscript):|data:[a-z]+\/[a-z0-9.+-]+[;,]/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) ?? '').length;

/** Whether a data-binding path stays inside this surface's data model. */
export function isSurfaceDataPath(path: unknown, { allowRoot = false } = {}): path is string {
	if (typeof path !== 'string') return false;
	if (path === '/') return allowRoot;
	if (!path.startsWith('/')) return false;
	const segments = path.slice(1).split('/');
	return (
		segments.length <= LIMITS.maxPathSegments &&
		segments.every((segment) => PATH_SEGMENT.test(segment) && !RESERVED_KEYS.has(segment))
	);
}

export function isUnsafeUrlText(text: string): boolean {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is being stripped
	const compact = text.replace(/[\u0000- \u007f-\u009f]/g, '');
	return UNSAFE_SCHEME_PREFIX.test(compact) || UNSAFE_SCHEME_INSIDE.test(compact);
}

class Refusals {
	readonly list: GenerativeSurfaceRefusal[] = [];
	add(code: GenerativeSurfaceRefusalCode, at: string, message: string) {
		// One bad payload can trip the same rule thousands of times; the first few say enough.
		if (this.list.length < 20) this.list.push({ code, at, message });
	}
}

/**
 * Every value inside a message: strings bounded and free of executable URLs, keys not
 * reserved, nesting bounded, bindings inside the surface, no function calls (the v10r
 * catalog defines none, so a call could only reach a function the catalog never approved).
 */
function inspectValue(value: unknown, at: string, depth: number, refusals: Refusals): void {
	if (typeof value === 'string') {
		if (value.length > LIMITS.maxStringLength) {
			refusals.add('string_too_long', at, `string of ${value.length} characters exceeds ${LIMITS.maxStringLength}`);
		} else if (isUnsafeUrlText(value)) {
			refusals.add('unsafe_url', at, 'string carries an executable or embedded URL scheme');
		}
		return;
	}
	if (typeof value !== 'object' || value === null) return;
	if (depth > LIMITS.maxValueDepth) {
		refusals.add('value_too_deep', at, `value nests deeper than ${LIMITS.maxValueDepth} levels`);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			inspectValue(item, `${at}/${index}`, depth + 1, refusals);
		});
		return;
	}
	for (const key of Object.keys(value)) {
		const child = (value as Record<string, unknown>)[key];
		if (RESERVED_KEYS.has(key)) {
			refusals.add('reserved_key', `${at}/${key}`, `key "${key}" is reserved`);
			continue;
		}
		if (key === '@call' || key === 'functionCall') {
			refusals.add('function_call', `${at}/${key}`, 'function calls are not part of the v10r catalog');
			continue;
		}
		if (key === '@path' && !isSurfaceDataPath(child)) {
			refusals.add(
				'bad_binding_path',
				`${at}/${key}`,
				'binding path must be an absolute path of plain segments inside this surface',
			);
			continue;
		}
		if (key.length > LIMITS.maxStringLength || isUnsafeUrlText(key)) {
			refusals.add('unsafe_url', `${at}/${key}`, 'object key is oversized or carries a URL scheme');
			continue;
		}
		inspectValue(child, `${at}/${key}`, depth + 1, refusals);
	}
}

/** The child ids a component references, or a refusal when it uses a form v10r does not. */
function childIdsOf(component: Record<string, unknown>, at: string, refusals: Refusals): string[] {
	const ids: string[] = [];
	if ('child' in component) {
		if (typeof component.child === 'string') ids.push(component.child);
		else refusals.add('bad_component_id', `${at}/child`, 'child must be a component id');
	}
	if ('children' in component) {
		const list = component.children;
		if (isRecord(list)) {
			refusals.add('template_children', `${at}/children`, 'template children are not part of the v10r catalog');
		} else if (!Array.isArray(list) || !list.every((id) => typeof id === 'string')) {
			refusals.add('bad_component_id', `${at}/children`, 'children must be a list of component ids');
		} else if (list.length > LIMITS.maxChildren) {
			refusals.add('too_many_children', `${at}/children`, `${list.length} children exceed ${LIMITS.maxChildren}`);
		} else {
			ids.push(...list);
		}
	}
	return ids;
}

function inspectAction(action: unknown, at: string, refusals: Refusals): void {
	if (!isRecord(action) || !isRecord(action.event) || Object.keys(action).length !== 1) {
		refusals.add('bad_action', at, 'a Button action must be exactly {"event": {...}}');
		return;
	}
	const { name, context } = action.event;
	if (typeof name !== 'string' || !EVENT_NAME.test(name)) {
		refusals.add('bad_action', `${at}/event/name`, 'event name must be an identifier of at most 64 characters');
	}
	if (context !== undefined) {
		if (!isRecord(context)) refusals.add('bad_action', `${at}/event/context`, 'event context must be an object');
		else if (Object.keys(context).length > LIMITS.maxActionContextKeys) {
			refusals.add('bad_action', `${at}/event/context`, `event context exceeds ${LIMITS.maxActionContextKeys} keys`);
		}
	}
}

/**
 * A Chart's data, bounded and drawable: at most `maxChartLabels` labels and `maxChartSeries`
 * series, each series one finite, non-negative number per label. The catalog schema says the
 * same per field; the cross-field rule (one value per label) and finiteness only this check
 * can see. Negative values are refused rather than clipped: the renderer draws bars from zero,
 * and a bar that hides its sign would misstate the data.
 */
function inspectChart(component: Record<string, unknown>, at: string, refusals: Refusals): void {
	const { labels, series } = component;
	if (!Array.isArray(labels) || labels.length === 0 || labels.length > LIMITS.maxChartLabels) {
		refusals.add('bad_chart', `${at}/labels`, `a chart needs 1 to ${LIMITS.maxChartLabels} labels`);
		return;
	}
	if (!Array.isArray(series) || series.length === 0 || series.length > LIMITS.maxChartSeries) {
		refusals.add('bad_chart', `${at}/series`, `a chart needs 1 to ${LIMITS.maxChartSeries} series`);
		return;
	}
	series.forEach((entry, index) => {
		const values = isRecord(entry) ? entry.values : undefined;
		const drawable =
			Array.isArray(values) &&
			values.length === labels.length &&
			values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
		if (!drawable) {
			refusals.add(
				'bad_chart',
				`${at}/series/${index}/values`,
				'each series needs one finite, non-negative number per label',
			);
		}
	});
}

function inspectComponents(list: unknown, at: string, components: Map<string, GraphNode>, refusals: Refusals): void {
	if (!Array.isArray(list)) {
		refusals.add('unknown_message', at, 'components must be a list');
		return;
	}
	const seen = new Set<string>();
	list.forEach((component, index) => {
		const where = `${at}/${index}`;
		if (!isRecord(component)) {
			refusals.add('unknown_component', where, 'a component must be an object');
			return;
		}
		const { id, component: type } = component;
		if (typeof id !== 'string' || !COMPONENT_ID.test(id)) {
			refusals.add('bad_component_id', `${where}/id`, 'component id must be an identifier of at most 64 characters');
			return;
		}
		if (seen.has(id))
			refusals.add('duplicate_component', `${where}/id`, `component "${id}" appears twice in one batch`);
		seen.add(id);
		if (!isGenerativeUiComponent(type)) {
			refusals.add(
				'unknown_component',
				`${where}/component`,
				`"${String(type).slice(0, 64)}" is not in the v10r catalog`,
			);
			return;
		}
		if (component.catalogId !== undefined && component.catalogId !== GENERATIVE_UI_CATALOG_ID) {
			refusals.add('unknown_catalog', `${where}/catalogId`, 'components may only come from the v10r catalog');
		}
		if (type === 'Button') inspectAction(component.action, `${where}/action`, refusals);
		if (type === 'Chart') inspectChart(component, where, refusals);
		const children = childIdsOf(component, where, refusals);
		for (const key of Object.keys(component)) {
			if (ENVELOPE_KEYS.has(key) || key === 'child' || key === 'children') continue;
			inspectValue(component[key], `${where}/${key}`, 1, refusals);
		}
		if (isRecord(component.accessibility)) inspectValue(component.accessibility, `${where}/accessibility`, 1, refusals);
		components.set(id, { type, children });
	});
}

function recordDataWrite(writes: Map<string, number>, path: string, bytes: number): void {
	for (const existing of [...writes.keys()]) {
		if (path === '/' || existing === path || existing.startsWith(`${path}/`)) writes.delete(existing);
	}
	writes.set(path, bytes);
}

/**
 * Root present, children defined, no cycle, depth and rendered nodes bounded — over the
 * merged graph (every component the surface holds after this batch, reachable from `root` or
 * not).
 *
 * Linear in components plus references: each component is walked once, children before
 * parents, and keeps two memoised figures — the longest chain below it and the nodes it would
 * render. The renderer makes one node per reference, so a component referenced from two places
 * counts twice; the count saturates just above the budget, so a 2^30 expansion costs as much
 * to check as a 30-node chain. A walk per reference (what a renderer does) would be
 * exponential on a DAG of shared children — the very input this check exists to refuse.
 */
function inspectGraph(components: ReadonlyMap<string, GraphNode>, complete: boolean, refusals: Refusals): void {
	if (components.size > LIMITS.maxComponents) {
		refusals.add('too_many_components', '', `${components.size} components exceed ${LIMITS.maxComponents}`);
		return;
	}
	if (!components.has('root')) {
		if (complete && components.size > 0) refusals.add('missing_root', '', 'no component has the id "root"');
		if (complete && components.size === 0) refusals.add('missing_root', '', 'the surface defines no components');
		return;
	}
	if (complete) {
		for (const [id, node] of components) {
			for (const child of node.children) {
				if (!components.has(child)) refusals.add('missing_child', `#${id}`, `"${id}" references undefined "${child}"`);
			}
		}
	}
	const cap = LIMITS.maxRenderedNodes + 1;
	/** Longest chain of references below each walked component (a leaf is 0). */
	const height = new Map<string, number>();
	/** Nodes each walked component renders, itself included, saturated at `cap`. */
	const rendered = new Map<string, number>();
	const onBranch = new Set<string>();
	const reportedCycles = new Set<string>();
	// Recursion depth is bounded by the component count, checked above.
	const walk = (id: string): void => {
		onBranch.add(id);
		let longest = 0;
		let nodes = 1;
		for (const child of components.get(id)?.children ?? []) {
			if (!components.has(child)) {
				// Not defined yet: the renderer shows one placeholder for it.
				nodes = Math.min(cap, nodes + 1);
				continue;
			}
			if (onBranch.has(child)) {
				if (!reportedCycles.has(child))
					refusals.add('cyclic_reference', `#${id}`, `"${id}" references its ancestor "${child}"`);
				reportedCycles.add(child);
				continue;
			}
			if (!height.has(child)) walk(child);
			longest = Math.max(longest, (height.get(child) ?? 0) + 1);
			nodes = Math.min(cap, nodes + (rendered.get(child) ?? 1));
		}
		onBranch.delete(id);
		height.set(id, longest);
		rendered.set(id, nodes);
	};
	walk('root');
	// Disconnected components render nothing today, but one update that references them can
	// attach them; a cycle among them is never legitimate, so it is refused wherever it sits.
	for (const id of components.keys()) if (!height.has(id)) walk(id);
	if (reportedCycles.size > 0) return;
	const depth = height.get('root') ?? 0;
	if (depth > LIMITS.maxDepth) {
		refusals.add('too_deep', '#root', `the longest chain below root is ${depth} levels, over ${LIMITS.maxDepth}`);
	}
	const nodes = rendered.get('root') ?? 1;
	if (nodes > LIMITS.maxRenderedNodes) {
		refusals.add(
			'too_many_rendered_nodes',
			'#root',
			`root would render ${nodes >= cap ? `more than ${LIMITS.maxRenderedNodes}` : nodes} nodes (one per reference), over ${LIMITS.maxRenderedNodes}`,
		);
	}
}

/**
 * Check one batch of A2UI v1.0 messages against the surface policy, on top of the graph the
 * previous batches built. Returns the merged graph, or every refusal found (up to twenty).
 */
export function checkGenerativeSurfaceBatch(
	batch: unknown,
	options: GenerativeSurfacePolicyOptions = {},
): GenerativeSurfacePolicyResult {
	const refusals = new Refusals();
	const previous = options.previous ?? EMPTY_GENERATIVE_SURFACE_GRAPH;
	if (!Array.isArray(batch))
		return { ok: false, refusals: [{ code: 'not_a_batch', at: '', message: 'expected a list of messages' }] };
	if (batch.length > LIMITS.maxMessages) {
		return {
			ok: false,
			refusals: [
				{ code: 'too_many_messages', at: '', message: `${batch.length} messages exceed ${LIMITS.maxMessages}` },
			],
		};
	}
	const bytes = byteLength(batch);
	if (bytes > LIMITS.maxBatchBytes) {
		return {
			ok: false,
			refusals: [{ code: 'batch_too_large', at: '', message: `${bytes} bytes exceed ${LIMITS.maxBatchBytes}` }],
		};
	}

	let surfaceId = previous.surfaceId;
	/** The batch ends with the surface deleted: there is no tree left to require a root of. */
	let deleted = false;
	const components = new Map(previous.components);
	const writes = new Map(previous.dataModelWrites);

	batch.forEach((message, index) => {
		const at = `/${index}`;
		if (!isRecord(message)) {
			refusals.add('unknown_message', at, 'a message must be an object');
			return;
		}
		if (message.version !== GENERATIVE_UI_PROTOCOL_VERSION) {
			refusals.add('wrong_version', `${at}/version`, `version must be "${GENERATIVE_UI_PROTOCOL_VERSION}"`);
		}
		const kinds = Object.keys(message).filter((key) => key !== 'version');
		const kind = kinds[0] as (typeof MESSAGE_KINDS)[number];
		if (kinds.length !== 1 || !MESSAGE_KINDS.includes(kind)) {
			refusals.add('unknown_message', at, `expected exactly one of ${MESSAGE_KINDS.join(', ')}`);
			return;
		}
		const body = message[kind];
		const where = `${at}/${kind}`;
		if (!isRecord(body)) {
			refusals.add('unknown_message', where, `${kind} must be an object`);
			return;
		}
		const id = body.surfaceId;
		if (typeof id !== 'string' || !SURFACE_ID.test(id)) {
			refusals.add('bad_surface_id', `${where}/surfaceId`, 'surface id must be an identifier of at most 64 characters');
			return;
		}
		if (options.surfaceId !== undefined && id !== options.surfaceId) {
			refusals.add(
				'foreign_surface',
				`${where}/surfaceId`,
				`this batch may only address surface "${options.surfaceId}"`,
			);
			return;
		}

		if (kind === 'createSurface') {
			if (surfaceId !== null) {
				refusals.add('surface_exists', `${where}/surfaceId`, `surface "${surfaceId}" already exists`);
				return;
			}
			for (const key of Object.keys(body)) {
				if (!CREATE_SURFACE_KEYS.has(key))
					refusals.add('unknown_message', `${where}/${key}`, `"${key}" is not accepted`);
			}
			if (body.catalogId !== GENERATIVE_UI_CATALOG_ID) {
				refusals.add('unknown_catalog', `${where}/catalogId`, `catalogId must be ${GENERATIVE_UI_CATALOG_ID}`);
			}
			surfaceId = id;
			deleted = false;
			if (body.dataModel !== undefined) {
				if (!isRecord(body.dataModel))
					refusals.add('unknown_message', `${where}/dataModel`, 'dataModel must be an object');
				else {
					inspectDataModelKeys(body.dataModel, `${where}/dataModel`, refusals);
					inspectValue(body.dataModel, `${where}/dataModel`, 0, refusals);
					recordDataWrite(writes, '/', byteLength(body.dataModel));
				}
			}
			if (body.components !== undefined)
				inspectComponents(body.components, `${where}/components`, components, refusals);
			return;
		}
		if (surfaceId === null) {
			refusals.add('surface_not_created', `${where}/surfaceId`, 'createSurface must come first');
			return;
		}
		if (id !== surfaceId) {
			refusals.add('foreign_surface', `${where}/surfaceId`, `this surface is "${surfaceId}"`);
			return;
		}
		if (kind === 'deleteSurface') {
			deleted = true;
			surfaceId = null;
			components.clear();
			writes.clear();
			return;
		}
		if (kind === 'updateComponents') {
			inspectComponents(body.components, `${where}/components`, components, refusals);
			return;
		}
		// updateDataModel
		const path = body.path ?? '/';
		if (!isSurfaceDataPath(path, { allowRoot: true })) {
			refusals.add('bad_binding_path', `${where}/path`, 'path must be an absolute path of plain segments');
			return;
		}
		if (isRecord(body.value)) inspectDataModelKeys(body.value, `${where}/value`, refusals);
		inspectValue(body.value, `${where}/value`, 0, refusals);
		recordDataWrite(writes, path, byteLength(body.value ?? null));
	});

	const dataModelBytes = [...writes.values()].reduce((sum, n) => sum + n, 0);
	if (dataModelBytes > LIMITS.maxDataModelBytes) {
		refusals.add(
			'data_model_too_large',
			'',
			`data model of ${dataModelBytes} bytes exceeds ${LIMITS.maxDataModelBytes}`,
		);
	}
	if (refusals.list.length === 0 && !deleted) inspectGraph(components, options.complete ?? false, refusals);
	if (refusals.list.length > 0) return { ok: false, refusals: refusals.list };
	return { ok: true, graph: Object.freeze({ surfaceId, components, dataModelWrites: writes }) };
}

/** Data model keys are path segments, so every stored value stays addressable by a binding. */
function inspectDataModelKeys(value: unknown, at: string, refusals: Refusals, depth = 0): void {
	if (depth > LIMITS.maxValueDepth || typeof value !== 'object' || value === null) return;
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			inspectDataModelKeys(item, `${at}/${index}`, refusals, depth + 1);
		});
		return;
	}
	for (const [key, child] of Object.entries(value)) {
		if (!PATH_SEGMENT.test(key) || RESERVED_KEYS.has(key)) {
			refusals.add('bad_binding_path', `${at}/${key.slice(0, 64)}`, 'data model keys must be plain path segments');
			continue;
		}
		inspectDataModelKeys(child, `${at}/${key}`, refusals, depth + 1);
	}
}
