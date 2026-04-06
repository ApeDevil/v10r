/**
 * Shared types for desk AI tools.
 */

/** Client-side effect instruction dispatched via writeData() during tool execution. */
export type DeskEffect =
	| { type: 'desk:open_panel'; panelType: string; fileId: string; label: string }
	| { type: 'desk:refresh_file'; fileId: string }
	| { type: 'desk:refresh_explorer' }
	| { type: 'desk:tab_indicator'; fileId: string; panelType: string; variant: 'modified' | 'created' | 'deleted' }
	| { type: 'desk:notify'; message: string; level: 'info' | 'success' | 'error' };

/** Tool permission scopes the client requests. */
export type DeskToolScope = 'desk:read' | 'desk:write' | 'desk:create' | 'desk:delete';
