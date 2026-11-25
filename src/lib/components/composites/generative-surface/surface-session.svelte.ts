/**
 * One rendered generative surface: web_core's message processor and node resolver, the
 * surface policy in front of them, and the reactive state the Svelte renderer reads.
 *
 * Every batch passes the surface policy (`#lib/generative-ui/policy.ts`) before web_core sees
 * it, even though the server compiler already checked it: the renderer also takes fixtures,
 * replayed streams and whatever a future transport delivers, and must not trust any of them.
 * web_core then validates each component against the v10r catalog's JSON Schema.
 *
 * A batch applies whole or not at all. web_core's `processMessagesWithErrors` is not atomic:
 * it applies each message on its own, keeps the ones before a failing message, skips the
 * failing one and still applies the ones after it (and a `createSurface` whose components
 * fail leaves the surface created, data model set, without components). So when web_core
 * rejects anything in a batch the policy passed, the session throws that processor away and
 * rebuilds a fresh one from the last accepted surface — its components plus the data model as
 * it was just before the batch, user edits included. The policy graph, the processor and the
 * resolver tree therefore always describe the same surface.
 *
 * Inputs edit the data model locally (no round trip); only a Button press leaves the surface,
 * as a bounded `GenerativeSurfaceAction` the page receives through `onaction`.
 */
import { type ComponentNode, MessageProcessor, NodeResolver } from '@a2ui/web_core';
import {
	checkGenerativeSurfaceBatch,
	EMPTY_GENERATIVE_SURFACE_GRAPH,
	GENERATIVE_SURFACE_LIMITS,
	GENERATIVE_UI_PROTOCOL_VERSION,
	type GenerativeSurfaceAction,
	type GenerativeSurfaceGraph,
	type GenerativeSurfaceMessage,
	type GenerativeSurfaceRefusal,
	toGenerativeSurfaceAction,
} from '#lib/generative-ui/index.ts';
import { loadGenerativeUiCatalog } from '#lib/generative-ui/load-catalog.ts';
import { readSignal } from './signal-reader.svelte.ts';

/** A batch of messages, or a stream that yields messages or batches as they arrive. */
export type GenerativeSurfaceInput = readonly unknown[] | AsyncIterable<unknown>;

export interface GenerativeSurfaceSessionOptions {
	onaction?: (action: GenerativeSurfaceAction) => void;
	onrefusal?: (refusals: readonly GenerativeSurfaceRefusal[]) => void;
}

export interface GenerativeSurfaceSession {
	/** The root component node, once a surface with a root exists. */
	readonly root: ComponentNode | undefined;
	readonly surfaceId: string | null;
	/** Batches applied so far — the live region announces a change when it grows. */
	readonly batches: number;
	/** The refusals of the last refused batch; empty once a later batch applies. */
	readonly refusals: readonly GenerativeSurfaceRefusal[];
	readonly streaming: boolean;
	/** Apply one message or batch, whole or not at all. Returns whether it was applied. */
	apply(chunk: unknown): boolean;
	/** Apply a stream's chunks in order until it ends or `signal` aborts. */
	consume(stream: AsyncIterable<unknown>, signal?: AbortSignal): Promise<void>;
	/** Read the surface's data model (for a page that wants the edited values). */
	read(path?: string): unknown;
	/**
	 * The surface as it stands, as one `createSurface` message: its components and its data
	 * model, user edits included. `apply` it to a fresh session to restore the surface (a
	 * restored conversation); it passes the policy again, like any other input. Empty when no
	 * surface exists.
	 */
	snapshot(): GenerativeSurfaceMessage[];
	dispose(): void;
}

interface ProcessorError {
	error?: { code?: string; path?: string; message?: string };
}

type CreateSurfaceBody = Extract<GenerativeSurfaceMessage, { createSurface: unknown }>['createSurface'];

/** What the accepted batches built, kept so a fresh processor can be rebuilt from it. */
interface AcceptedSurface {
	/** The `createSurface` envelope without components or data model. */
	readonly create: Omit<CreateSurfaceBody, 'components' | 'dataModel'>;
	/** Each component's latest definition — a v1.0 update replaces a component whole. */
	readonly components: ReadonlyMap<string, Record<string, unknown>>;
}

type Message = Record<string, Record<string, unknown>>;

/** The accepted surface after `messages`, which the policy has already passed. */
function acceptMessages(previous: AcceptedSurface | null, messages: readonly unknown[]): AcceptedSurface | null {
	let surface = previous;
	for (const message of messages as Message[]) {
		if (message.createSurface) {
			const { components, dataModel: _dataModel, ...create } = message.createSurface;
			surface = { create: create as AcceptedSurface['create'], components: new Map() };
			if (Array.isArray(components)) surface = withComponents(surface, components);
		} else if (message.deleteSurface) {
			surface = null;
		} else if (message.updateComponents && surface) {
			surface = withComponents(surface, message.updateComponents.components as unknown[]);
		}
	}
	return surface;
}

function withComponents(surface: AcceptedSurface, list: readonly unknown[]): AcceptedSurface {
	const components = new Map(surface.components);
	for (const component of list as Record<string, unknown>[]) components.set(component.id as string, component);
	return { create: surface.create, components };
}

function toCreateMessage(surface: AcceptedSurface, dataModel: unknown): GenerativeSurfaceMessage {
	return structuredClone({
		version: GENERATIVE_UI_PROTOCOL_VERSION,
		createSurface: {
			...surface.create,
			components: [...surface.components.values()],
			...(isRecord(dataModel) && Object.keys(dataModel).length > 0 ? { dataModel } : {}),
		},
	}) as GenerativeSurfaceMessage;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export function createGenerativeSurfaceSession(
	options: GenerativeSurfaceSessionOptions = {},
): GenerativeSurfaceSession {
	const catalog = loadGenerativeUiCatalog();
	let graph: GenerativeSurfaceGraph = EMPTY_GENERATIVE_SURFACE_GRAPH;
	let accepted: AcceptedSurface | null = null;
	let resolver = $state.raw<NodeResolver | undefined>();
	/** The surface model `resolver` reads — a recreated surface is a new model. */
	let resolved: unknown;
	const rootReader = $derived(resolver ? readSignal(resolver.rootNode) : undefined);
	let refusals = $state.raw<readonly GenerativeSurfaceRefusal[]>([]);
	let batches = $state(0);
	let streaming = $state(false);

	const refuse = (list: readonly GenerativeSurfaceRefusal[]) => {
		refusals = list;
		options.onrefusal?.(list);
		return false;
	};

	const createProcessor = () =>
		new MessageProcessor([catalog], (payload) => {
			const reading = toGenerativeSurfaceAction(payload);
			if (reading.ok) options.onaction?.(reading.action);
			else refuse([{ code: 'bad_action', at: '', message: `the action was not sent: ${reading.reason}` }]);
		});
	let processor = createProcessor();

	const currentSurface = (surfaceId: string | null) =>
		surfaceId === null ? undefined : processor.getSurface(surfaceId);

	function syncResolver(surfaceId: string | null): void {
		const surface = currentSurface(surfaceId);
		if (resolver && (surface !== resolved || resolver.disposed)) {
			resolver.dispose();
			resolver = undefined;
			resolved = undefined;
		}
		if (surface && !resolver) {
			resolver = new NodeResolver(surface, catalog);
			resolved = surface;
		}
	}

	/**
	 * Replace the processor with a fresh one holding the accepted surface and `dataModel`, so
	 * nothing a refused batch half-applied survives.
	 */
	function rebuild(dataModel: unknown): void {
		resolver?.dispose();
		resolver = undefined;
		resolved = undefined;
		processor.dispose();
		processor = createProcessor();
		if (accepted) {
			const errors = processor.processMessagesWithErrors([toCreateMessage(accepted, dataModel)] as never[]);
			if (errors.length > 0) {
				// The accepted surface was valid when it was accepted; if it no longer replays, show
				// nothing rather than a surface the policy graph does not describe.
				processor.dispose();
				processor = createProcessor();
				accepted = null;
				graph = EMPTY_GENERATIVE_SURFACE_GRAPH;
			}
		}
		syncResolver(graph.surfaceId);
	}

	function apply(chunk: unknown): boolean {
		const messages = Array.isArray(chunk) ? chunk : [chunk];
		const checked = checkGenerativeSurfaceBatch(messages, { previous: graph });
		if (!checked.ok) return refuse(checked.refusals);
		// Cloned: web_core keeps references into what it applies, and a caller's object (a
		// fixture, a cached tool result) must never become the live data model.
		const applying = structuredClone(messages);
		const next = acceptMessages(accepted, structuredClone(messages));
		const dataBefore = structuredClone(currentSurface(graph.surfaceId)?.dataModel.get('/'));
		const errors = processor.processMessagesWithErrors(applying) as ProcessorError[];
		if (errors.length > 0) {
			rebuild(dataBefore);
			return refuse(
				errors.slice(0, 20).map(({ error }) => ({
					code: 'catalog_violation',
					at: error?.path ?? '',
					message: error?.message ?? 'the renderer rejected the batch',
				})),
			);
		}
		syncResolver(checked.graph.surfaceId);
		// Defence in depth: the policy bounds the nodes root renders; if the resolver ever builds
		// more (a policy bug, a web_core change), the tree is dropped before anything renders it.
		const nodes = resolver?.activeNodeCount ?? 0;
		if (nodes > GENERATIVE_SURFACE_LIMITS.maxRenderedNodes) {
			rebuild(dataBefore);
			return refuse([
				{
					code: 'too_many_rendered_nodes',
					at: '#root',
					message: `the renderer built ${nodes} nodes, over ${GENERATIVE_SURFACE_LIMITS.maxRenderedNodes}`,
				},
			]);
		}
		graph = checked.graph;
		accepted = next;
		refusals = [];
		batches += 1;
		return true;
	}

	async function consume(stream: AsyncIterable<unknown>, signal?: AbortSignal): Promise<void> {
		streaming = true;
		try {
			for await (const chunk of stream) {
				if (signal?.aborted) break;
				apply(chunk);
			}
		} finally {
			streaming = false;
		}
	}

	return {
		get root() {
			return rootReader?.current;
		},
		get surfaceId() {
			return graph.surfaceId;
		},
		get batches() {
			return batches;
		},
		get refusals() {
			return refusals;
		},
		get streaming() {
			return streaming;
		},
		apply,
		consume,
		read(path = '/') {
			return currentSurface(graph.surfaceId)?.dataModel.get(path);
		},
		snapshot() {
			if (!accepted) return [];
			return [toCreateMessage(accepted, currentSurface(graph.surfaceId)?.dataModel.get('/'))];
		},
		dispose() {
			resolver?.dispose();
			resolver = undefined;
			resolved = undefined;
			processor.dispose();
		},
	};
}
