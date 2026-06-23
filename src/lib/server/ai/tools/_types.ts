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

/**
 * Tool permission scopes the desk client requests. Deskbot-only — the chatbot has no scopes.
 * `desk:ask` is a READ-ONLY grounding scope (deskbot nRAG over the user's own files); it is
 * NOT a mutating scope and never triggers the plan gate.
 */
export type DeskToolScope = 'desk:read' | 'desk:write' | 'desk:create' | 'desk:delete' | 'desk:ask';

/**
 * Risk classification for a tool (surface-neutral). Drives UI gating (plan card vs.
 * confirm card vs. auto), governor audit priority, and the `shouldRequirePlan` predicate.
 *
 * - `read` — no side effects; always auto-approved
 * - `create` — new entity; reversible via soft delete, auto-approved with notification
 * - `write` — mutates an existing entity; confirm card when target is user-originated
 * - `destructive` — delete or unrecoverable mutation; always explicit confirm
 */
export type ToolRisk = 'read' | 'create' | 'write' | 'destructive';

/**
 * Metadata for a tool with no scope gating — the chatbot's read-only retrieval tools.
 * Registered in parallel with the tool definition (AI SDK `tool()` has no metadata slot).
 */
export interface ToolMeta {
	risk: ToolRisk;
}

/** Metadata for a desk tool — risk plus the scope that gates it. Deskbot-only. */
export interface DeskToolMeta extends ToolMeta {
	scope: DeskToolScope;
}

/** Desk layout entry from the client request body. */
export interface DeskLayoutEntry {
	panelId: string;
	fileId?: string;
	fileType?: string;
	label: string;
}
