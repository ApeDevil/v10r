/**
 * EXPLORER NODE — Unified interface for all items in the Explorer tree.
 *
 * Per-source adapters normalize API responses into this shape.
 * Context menus and tree rendering are driven by `capabilities`.
 */

export type NodeCapability =
	| 'open'
	| 'open-new-panel'
	| 'rename'
	| 'delete'
	| 'duplicate'
	| 'move'
	| 'ai-context'
	| 'export-markdown'
	| 'insert-into-document'
	| 'copy-url'
	| 'new-folder'
	| 'new-spreadsheet';

export type NodeSource = 'desk-file' | 'desk-folder' | 'blog-post' | 'blog-asset' | 'virtual';

export interface ExplorerNode {
	/** Unique across all sources (prefixed IDs handle this, virtual nodes use `virtual:` prefix). */
	id: string;
	/** Parent node ID. null = top-level root. */
	parentId: string | null;
	/** Which backend this node comes from — drives mutation dispatch. */
	source: NodeSource;
	/** Original API response data for dispatching mutations. */
	sourceData: Record<string, unknown>;
	/** Display name. */
	label: string;
	/** UnoCSS icon class (e.g., 'i-lucide-file-text'). */
	icon: string;
	/** CSS color for the icon (e.g., 'var(--color-primary)'). */
	iconColor?: string;
	/** Whether this node is a folder (expandable, can receive drops). */
	isFolder: boolean;
	/** Operations this node supports — drives context menu items. */
	capabilities: Set<NodeCapability>;
	/** AI context pin state (desk files only). */
	aiContext?: boolean;
	/** Sort key: "0_name" for folders (sort first), "1_name" for files. */
	sortKey: string;
	/** Optional badge (e.g., post status). */
	badge?: { text: string; variant: 'success' | 'secondary' | 'warning' };
	/** Secondary text (e.g., post title, file size). */
	subtitle?: string;
	/** Child count for display in folder labels. -1 = don't show. */
	childCount?: number;
}
