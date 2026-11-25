/**
 * `render_surface` — the agent action that lets a model show a generative surface. Mounted
 * on the chatbot by the `generative-ui` capability (`ai/capabilities/generative-ui.ts`).
 *
 * The tool only *produces output*. Its `execute` compiles the model's Express source through
 * `compileGenerativeSurface` and returns the validated A2UI v1.0 messages as the tool result;
 * the chat client finds that result on the turn's stream (a tool-output part, like every
 * other tool's) and renders it with `LazyGenerativeSurface`. A refusal comes back as the
 * result instead, so the model can correct its source on the next step.
 *
 * Manifest entry (`#lib/types/ai-tools.ts` `TOOL_MANIFEST`):
 *
 *   { name: 'render_surface', surface: 'chatbot', risk: 'view', executor: 'server',
 *     capability: 'generative-ui', resultOrigin: 'system', reach: 'internal' }
 *
 * - `risk: 'view'` — a surface changes nothing stored; it is shown, edited locally, and can
 *   only emit `GenerativeSurfaceAction` events (`#lib/generative-ui/surface-action.ts`).
 * - `executor: 'server'` — compilation and validation run in the agent loop; the browser
 *   receives only messages that passed both.
 * - `capability: 'generative-ui'` — the capability also carries `buildGenerativeSurfacePrompt()`
 *   in its guidance.
 *
 * A surface action posted back by the browser is user input: it enters the next turn through
 * the surface action door (`surface-action-door.ts`), wrapped as untrusted content. If the
 * event implies a write, the model answers it with the ordinary write tool, and that tool's
 * approval gate applies — the Button press is never the approval.
 */
import { type Tool, tool } from 'ai';
import * as v from 'valibot';
import { GENERATIVE_SURFACE_LIMITS, type GenerativeSurfaceGraph } from '#lib/generative-ui/index.ts';
import type { ToolDescriptor } from '#lib/types/ai-tools.ts';
import { toolInputSchema } from '../tools/desk-mutation-inputs.ts';
import { compileGenerativeSurface } from './compile-surface.ts';

export const RENDER_SURFACE_TOOL_NAME = 'render_surface';

/** The manifest entry, minus the `capability` that does not exist until the tool is mounted. */
export const RENDER_SURFACE_TOOL_DESCRIPTOR = {
	name: RENDER_SURFACE_TOOL_NAME,
	surface: 'chatbot',
	risk: 'view',
	executor: 'server',
	resultOrigin: 'system',
	reach: 'internal',
} as const satisfies Omit<Extract<ToolDescriptor, { surface: 'chatbot' }>, 'capability'>;

export const RenderSurfaceInputSchema = v.strictObject({
	/** Reuse an id to update a surface already shown in this conversation. */
	surfaceId: v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)),
	/** The surface in A2UI Express, as the system prompt's catalog section describes it. */
	express: v.pipe(v.string(), v.maxLength(GENERATIVE_SURFACE_LIMITS.maxBatchBytes)),
});

const DESCRIPTION =
	'Show the user an interactive surface — a form to collect missing details, a comparison table, a choice to make — ' +
	'composed from the catalog in your instructions and written in A2UI Express. The surface is display only: its ' +
	'buttons send you an event with the values the user entered; they never save or change anything. ' +
	'If the result lists refusals, fix the source and call again.';

/**
 * The tool, with the per-conversation memory of surfaces it has shown so a later call with the
 * same `surfaceId` is checked as an update of that surface rather than a new one.
 */
export function createRenderSurfaceTool(shown: Map<string, GenerativeSurfaceGraph> = new Map()): Tool {
	return tool({
		description: DESCRIPTION,
		inputSchema: toolInputSchema(RenderSurfaceInputSchema),
		execute: async ({ surfaceId, express }) => {
			const compiled = compileGenerativeSurface(
				{ format: 'express', source: express },
				{ surfaceId, previous: shown.get(surfaceId) },
			);
			if (!compiled.ok) return { ok: false as const, surfaceId, refusals: compiled.refusals };
			shown.set(surfaceId, compiled.graph);
			return { ok: true as const, surfaceId, messages: compiled.messages };
		},
	});
}
