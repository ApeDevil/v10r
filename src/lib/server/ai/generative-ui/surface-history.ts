/**
 * The generative surfaces a conversation has shown, read back from its messages.
 *
 * A surface lives in the conversation, nowhere else: each `render_surface` call that compiled
 * is a tool part (`tool-render_surface`, `output-available`, `output.ok`) on an assistant
 * message, persisted with the message's parts like every other tool call. Replaying those
 * parts in order gives, per surface id, the current graph (what the next update is checked
 * against), the current components (what a surface action is checked against) and the id of
 * the render that produced the current version (what a stale action is told apart by).
 *
 * Framework-free and transport-free: the orchestrator reads it over the client's history (the
 * graph the model's next update builds on); the surface action door reads it over the
 * conversation's persisted rows, which the client cannot write.
 */
import {
	checkGenerativeSurfaceBatch,
	EMPTY_GENERATIVE_SURFACE_GRAPH,
	type GenerativeSurfaceGraph,
	type GenerativeSurfaceMessage,
} from '#lib/generative-ui/index.ts';
import { RENDER_SURFACE_TOOL_NAME } from './render-surface-tool.ts';

/** One successful `render_surface` call, as its tool part records it. */
export interface SurfaceRender {
	surfaceId: string;
	/** The tool call id — the render's identity, and the version a surface action names. */
	renderId: string;
	messages: readonly GenerativeSurfaceMessage[];
}

/** The current state of one surface after every render the conversation holds. */
export interface SurfaceVersion {
	surfaceId: string;
	/** The render that produced this version. */
	renderId: string;
	graph: GenerativeSurfaceGraph;
	/** Components by id, as the last batches left them (raw A2UI component objects). */
	components: ReadonlyMap<string, Record<string, unknown>>;
	/** The surface was deleted by its latest render. */
	deleted: boolean;
}

interface PartsBearing {
	parts?: readonly unknown[] | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const RENDER_PART_TYPE = `tool-${RENDER_SURFACE_TOOL_NAME}`;

/** Every successful render in the messages, in conversation order. */
export function surfaceRendersOf(messages: readonly PartsBearing[]): SurfaceRender[] {
	const renders: SurfaceRender[] = [];
	for (const message of messages) {
		for (const part of message.parts ?? []) {
			if (!isRecord(part) || part.type !== RENDER_PART_TYPE || part.state !== 'output-available') continue;
			const output = part.output;
			if (!isRecord(output) || output.ok !== true || typeof output.surfaceId !== 'string') continue;
			if (!Array.isArray(output.messages) || typeof part.toolCallId !== 'string') continue;
			renders.push({
				surfaceId: output.surfaceId,
				renderId: part.toolCallId,
				messages: output.messages as GenerativeSurfaceMessage[],
			});
		}
	}
	return renders;
}

function applyComponents(
	components: Map<string, Record<string, unknown>>,
	list: unknown,
): Map<string, Record<string, unknown>> {
	if (!Array.isArray(list)) return components;
	for (const component of list)
		if (isRecord(component) && typeof component.id === 'string') components.set(component.id, component);
	return components;
}

/**
 * Replay the renders into one version per surface id. A render the policy would refuse on top
 * of what came before (a forged or corrupted history) ends that surface's replay: the version
 * stays at the last render that checked, so nothing downstream trusts an unchecked batch.
 */
export function replaySurfaces(renders: readonly SurfaceRender[]): Map<string, SurfaceVersion> {
	const versions = new Map<string, SurfaceVersion>();
	const broken = new Set<string>();
	for (const render of renders) {
		if (broken.has(render.surfaceId)) continue;
		const previous = versions.get(render.surfaceId);
		const startsFresh = !previous || previous.deleted;
		const checked = checkGenerativeSurfaceBatch(render.messages, {
			previous: startsFresh ? EMPTY_GENERATIVE_SURFACE_GRAPH : previous.graph,
			surfaceId: render.surfaceId,
		});
		if (!checked.ok) {
			broken.add(render.surfaceId);
			continue;
		}
		let components = new Map(startsFresh ? [] : previous.components);
		let deleted = false;
		for (const message of render.messages) {
			if ('createSurface' in message) {
				components = applyComponents(new Map(), message.createSurface.components);
				deleted = false;
			} else if ('updateComponents' in message) {
				components = applyComponents(components, message.updateComponents.components);
			} else if ('deleteSurface' in message) {
				components = new Map();
				deleted = true;
			}
		}
		versions.set(render.surfaceId, {
			surfaceId: render.surfaceId,
			renderId: render.renderId,
			graph: checked.graph,
			components,
			deleted,
		});
	}
	return versions;
}

/** The graphs a new `render_surface` call updates — the tool's per-conversation memory. */
export function surfaceGraphsFromHistory(messages: readonly PartsBearing[]): Map<string, GenerativeSurfaceGraph> {
	const graphs = new Map<string, GenerativeSurfaceGraph>();
	for (const [id, version] of replaySurfaces(surfaceRendersOf(messages)))
		if (!version.deleted) graphs.set(id, version.graph);
	return graphs;
}
