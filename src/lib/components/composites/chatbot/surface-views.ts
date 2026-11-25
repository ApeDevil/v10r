/**
 * Which generative surface each `render_surface` tool part of a thread shows.
 *
 * A surface is built by one or more renders (the first creates it, later ones with the same
 * surface id update it). Only the latest render of a surface shows it — with every batch the
 * thread holds for that surface, so a reloaded conversation rebuilds the same view — and only
 * that one is interactive: an earlier render is superseded and renders nothing, which is what
 * keeps a stale Button from being pressed. A Button press is sent with the latest render's id;
 * the server checks the same thing against the persisted conversation.
 */
import { isToolPart } from './tool-part';

/** `tool-<name>` of the chatbot's output tool (`TOOL_MANIFEST` `render_surface`). */
export const RENDER_SURFACE_PART = 'tool-render_surface';

export interface SurfaceView {
	surfaceId: string;
	/** The render a Button press is sent against. */
	renderId: string;
	messages: readonly unknown[];
}

interface RenderOutput {
	ok: true;
	surfaceId: string;
	messages: unknown[];
}

const isRenderOutput = (output: unknown): output is RenderOutput =>
	typeof output === 'object' &&
	output !== null &&
	(output as RenderOutput).ok === true &&
	typeof (output as RenderOutput).surfaceId === 'string' &&
	Array.isArray((output as RenderOutput).messages);

/**
 * Map every render's tool call id to the view it shows: a `SurfaceView` for the latest render
 * of its surface, `null` for a superseded one. Renders that refused are not in the map.
 */
export function surfaceViewsOf(
	messages: readonly { parts?: readonly { type: string }[] }[],
): Map<string, SurfaceView | null> {
	const batches = new Map<string, unknown[]>();
	const latest = new Map<string, string>();
	const order: string[] = [];
	for (const message of messages) {
		for (const part of message.parts ?? []) {
			if (part.type !== RENDER_SURFACE_PART || !isToolPart(part) || part.state !== 'output-available') continue;
			if (!isRenderOutput(part.output)) continue;
			const { surfaceId } = part.output;
			batches.set(surfaceId, [...(batches.get(surfaceId) ?? []), ...part.output.messages]);
			latest.set(surfaceId, part.toolCallId);
			order.push(`${surfaceId}\u0000${part.toolCallId}`);
		}
	}
	const views = new Map<string, SurfaceView | null>();
	for (const key of order) {
		const [surfaceId, renderId] = key.split('\u0000') as [string, string];
		views.set(
			renderId,
			latest.get(surfaceId) === renderId ? { surfaceId, renderId, messages: batches.get(surfaceId) ?? [] } : null,
		);
	}
	return views;
}
