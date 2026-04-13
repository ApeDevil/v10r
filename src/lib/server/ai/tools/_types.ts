/**
 * Shared types for desk AI tools.
 */

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

/** Tool permission scopes the client requests. */
export type DeskToolScope = 'desk:read' | 'desk:write' | 'desk:create' | 'desk:delete';

/**
 * Risk classification for a tool. Drives UI gating (plan card vs. confirm card vs. auto),
 * governor audit priority, and the `shouldRequirePlan` predicate.
 *
 * - `read` — no side effects; always auto-approved
 * - `create` — new entity; reversible via soft delete, auto-approved with notification
 * - `write` — mutates an existing entity; confirm card when target is user-originated
 * - `destructive` — delete or unrecoverable mutation; always explicit confirm
 */
export type DeskToolRisk = 'read' | 'create' | 'write' | 'destructive';

/** Metadata for a desk tool. Registered in parallel with the tool definition (AI SDK `tool()` has no metadata slot). */
export interface DeskToolMeta {
	risk: DeskToolRisk;
	scope: DeskToolScope;
}

/** Desk layout entry from the client request body. */
export interface DeskLayoutEntry {
	panelId: string;
	fileId?: string;
	fileType?: string;
	label: string;
}
