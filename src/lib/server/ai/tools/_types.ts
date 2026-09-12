/**
 * Shared types for desk AI tools.
 *
 * The surface-neutral contract types (ToolDescriptor, ToolRisk, DeskToolScope,
 * ToolMeta, DeskToolMeta) and the TOOL_MANIFEST itself live in the client-safe
 * `$lib/types/ai-tools.ts` — the public showcase topology renders from the same
 * source the server derives its meta maps from. Only the genuinely server-side
 * shapes stay here.
 */

export type { DeskEffect, DeskToolMeta, DeskToolScope, ToolDescriptor, ToolMeta, ToolRisk } from '$lib/types/ai-tools';
export { DESK_TOOL_SCOPES } from '$lib/types/ai-tools';

/** Desk layout entry from the client request body. */
export interface DeskLayoutEntry {
	panelId: string;
	fileId?: string;
	fileType?: string;
	label: string;
}
