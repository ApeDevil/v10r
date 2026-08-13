/**
 * Shared types for desk AI tools.
 *
 * The surface-neutral contract types (ToolDescriptor, ToolRisk, DeskToolScope,
 * ToolMeta, DeskToolMeta) and the TOOL_MANIFEST itself live in the client-safe
 * `$lib/types/ai-tools.ts` — the public showcase topology renders from the same
 * source the server derives its meta maps from. Only the genuinely server-side
 * shapes stay here.
 */

export type { DeskToolMeta, DeskToolScope, ToolDescriptor, ToolMeta, ToolRisk } from '$lib/types/ai-tools';

/** Client-side effect instruction dispatched via writeData() during tool execution. */
export type DeskEffect =
	| { type: 'desk:open_panel'; panelType: string; fileId: string; label: string }
	| { type: 'desk:refresh_file'; fileId: string }
	| { type: 'desk:refresh_explorer' }
	| { type: 'desk:tab_indicator'; fileId: string; panelType: string; variant: 'modified' | 'created' | 'deleted' }
	| { type: 'desk:notify'; message: string; level: 'info' | 'success' | 'error' }
	| { type: 'desk:activate_panel'; panelId: string }
	| { type: 'desk:scroll_to'; panelId: string; target: string }
	| { type: 'desk:focus_panel'; panelId: string };

/** Desk layout entry from the client request body. */
export interface DeskLayoutEntry {
	panelId: string;
	fileId?: string;
	fileType?: string;
	label: string;
}
