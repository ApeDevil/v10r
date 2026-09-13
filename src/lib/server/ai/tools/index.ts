/**
 * Tool metadata — the per-surface risk/scope maps the admin topology, the replay door and
 * the drift tests read, derived from the client-safe `TOOL_MANIFEST`.
 *
 * The tool factories live one per family in this directory; the capability that mounts each
 * (`$lib/server/ai/capabilities/*`) imports its factory directly, and a profile's
 * `composeTurn` assembles the turn's tool set from the active capabilities.
 */

import { TOOL_MANIFEST, type ToolDescriptor } from '$lib/types/ai-tools';
import type { DeskToolMeta, ToolMeta, ToolRisk } from './_types';

// The declarative tool registry lives in the client-safe `$lib/types/ai-tools.ts` (the
// showcase topology renders from the same source). Re-exported here so server-side
// consumers keep one import site; the meta maps below are derived from it.
export { TOOL_MANIFEST } from '$lib/types/ai-tools';
export type {
	DeskEffect,
	DeskLayoutEntry,
	DeskToolMeta,
	DeskToolScope,
	ToolDescriptor,
	ToolMeta,
	ToolRisk,
} from './_types';

/** Chatbot (retrieval) tool metadata — read-only, NO scope field. Derived from the manifest. */
export const chatbotToolMeta: Record<string, ToolMeta> = Object.fromEntries(
	TOOL_MANIFEST.filter((d) => d.surface === 'chatbot').map((d) => [d.name, { risk: d.risk }]),
);

/** Deskbot tool metadata — risk + the desk scope that gates each tool. Derived from the manifest. */
export const deskbotToolMeta: Record<string, DeskToolMeta> = Object.fromEntries(
	TOOL_MANIFEST.filter((d): d is Extract<ToolDescriptor, { surface: 'deskbot' }> => d.surface === 'deskbot').map(
		(d) => [d.name, { risk: d.risk, scope: d.scope }],
	),
);

/** Union of both surfaces — for admin/telemetry that needs every tool regardless of surface. */
export const allToolMeta: Record<string, ToolMeta> = { ...chatbotToolMeta, ...deskbotToolMeta };

/** Get the risk classification for a tool name, or `undefined` if unknown. */
export function getToolRisk(toolName: string): ToolRisk | undefined {
	return allToolMeta[toolName]?.risk;
}
