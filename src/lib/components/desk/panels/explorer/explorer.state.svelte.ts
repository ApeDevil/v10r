/**
 * EXPLORER STATE — Reactive flat Map state for the Explorer tree.
 *
 * Stores all nodes (virtual folders, desk folders, files, blog posts, assets)
 * in a flat Map keyed by ID. Parent-child relationships via `parentId` refs.
 * O(1) lookups and moves. Svelte 5 $state tracks fine-grained mutations.
 */
import type { ExplorerNode } from './node';

export class ExplorerState {
	nodes = $state<Map<string, ExplorerNode>>(new Map());
	expanded = $state<Set<string>>(new Set(['virtual:blog', 'virtual:assets', 'virtual:data']));
	/** Assets-root filter: when true, non-image blog-assets are hidden across the asset subtree. */
	showImagesOnly = $state<boolean>(false);
	selectedId = $state<string | null>(null);
	/** Roving-tabindex cursor for keyboard nav — separate from selectedId. */
	focusedId = $state<string | null>(null);
	/** Shared source of truth during a drag (Firefox can't read dataTransfer in dragover). */
	draggingId = $state<string | null>(null);
	/** aria-live announcement target for move feedback. */
	moveAnnouncement = $state<string>('');
	renamingId = $state<string | null>(null);
	deletingId = $state<string | null>(null);
	/** Separate reactive signal for AI context pins (works around svelte:self deep-reactivity issue). */
	aiPins = $state<Map<string, boolean>>(new Map());

	/** Replace all nodes from fresh API data. Preserves expanded state. */
	setNodes(nodes: ExplorerNode[]): void {
		this.nodes = new Map(nodes.map((n) => [n.id, n]));
		this.aiPins = new Map(nodes.filter((n) => n.aiContext).map((n) => [n.id, true]));
	}

	/** Get direct children of a node, sorted: folders first, then alphabetical. */
	getChildren(parentId: string | null): ExplorerNode[] {
		const children: ExplorerNode[] = [];
		for (const node of this.nodes.values()) {
			if (node.parentId === parentId) children.push(node);
		}
		// Assets-subtree "Images only" filter — hides non-image asset leaves at any depth.
		// Folders and non-asset sources pass through untouched.
		const filtered = this.showImagesOnly
			? children.filter((n) => {
					if (n.source !== 'blog-asset') return true;
					const mime = (n.sourceData as { mimeType?: string }).mimeType ?? '';
					return mime.startsWith('image/');
				})
			: children;
		return filtered.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
	}

	/** Get root-level nodes (parentId === null). */
	getRoots(): ExplorerNode[] {
		return this.getChildren(null);
	}

	/** Get node by ID. */
	getNode(id: string): ExplorerNode | undefined {
		return this.nodes.get(id);
	}

	/** Toggle expanded state of a folder. */
	toggleExpanded(nodeId: string): void {
		const next = new Set(this.expanded);
		if (next.has(nodeId)) next.delete(nodeId);
		else next.add(nodeId);
		this.expanded = next;
	}

	/** Move a node to a new parent (optimistic). Returns a rollback function. */
	moveNode(nodeId: string, newParentId: string | null): () => void {
		const node = this.nodes.get(nodeId);
		if (!node) return () => {};

		const previousParentId = node.parentId;
		const next = new Map(this.nodes);
		next.set(nodeId, { ...node, parentId: newParentId });
		this.nodes = next;

		return () => {
			const current = this.nodes.get(nodeId);
			if (!current) return;
			const rb = new Map(this.nodes);
			rb.set(nodeId, { ...current, parentId: previousParentId });
			this.nodes = rb;
		};
	}

	/** Enter rename mode for a node. Cancels any active rename/delete. */
	startRename(id: string): void {
		this.deletingId = null;
		this.renamingId = id;
	}

	/** Exit rename mode. */
	cancelRename(): void {
		this.renamingId = null;
	}

	/** Enter delete confirmation mode. Cancels any active rename/delete. */
	startDelete(id: string): void {
		this.renamingId = null;
		this.deletingId = id;
	}

	/** Exit delete confirmation mode. */
	cancelDelete(): void {
		this.deletingId = null;
	}

	/** Count all descendants of a node (recursive). */
	countDescendants(nodeId: string): number {
		let count = 0;
		for (const node of this.nodes.values()) {
			if (node.parentId === nodeId) {
				count++;
				if (node.isFolder) count += this.countDescendants(node.id);
			}
		}
		return count;
	}

	/** Get ancestor chain (for expand-to-reveal). */
	getAncestors(nodeId: string): string[] {
		const ancestors: string[] = [];
		let current = this.nodes.get(nodeId);
		while (current?.parentId) {
			ancestors.push(current.parentId);
			current = this.nodes.get(current.parentId);
		}
		return ancestors;
	}

	/**
	 * Check if moving `nodeId` under `targetId` would create a cycle.
	 * True when `targetId` equals `nodeId` or is any descendant of it.
	 * Mirror of the server-side recursive CTE for instant drag feedback.
	 */
	isCycleMove(nodeId: string, targetId: string): boolean {
		if (nodeId === targetId) return true;
		const ancestors = this.getAncestors(targetId);
		return ancestors.includes(nodeId);
	}

	/** Breadcrumb path (root → selected, excluding the selected node itself). Empty if nothing selected. */
	getBreadcrumbPath(nodeId: string | null): ExplorerNode[] {
		if (!nodeId) return [];
		return this.getAncestors(nodeId)
			.slice()
			.reverse()
			.map((id) => this.nodes.get(id))
			.filter((n): n is ExplorerNode => n !== undefined);
	}

	/** Folder-only list sorted by label — powers MoveToDialog search. */
	getFolderNodes(): ExplorerNode[] {
		const folders: ExplorerNode[] = [];
		for (const node of this.nodes.values()) {
			if (node.isFolder && node.source !== 'virtual') folders.push(node);
		}
		return folders.sort((a, b) => a.label.localeCompare(b.label));
	}

	/**
	 * Flat depth-first list of currently visible nodes, respecting `expanded`.
	 * Powers keyboard navigation (↓/↑/Home/End).
	 */
	getVisibleNodes(): ExplorerNode[] {
		const out: ExplorerNode[] = [];
		const walk = (parentId: string | null) => {
			for (const node of this.getChildren(parentId)) {
				out.push(node);
				if (node.isFolder && this.expanded.has(node.id)) walk(node.id);
			}
		};
		walk(null);
		return out;
	}

	/** Update a node's label (after successful rename). */
	updateLabel(nodeId: string, label: string): void {
		const node = this.nodes.get(nodeId);
		if (node) {
			node.label = label;
			node.sortKey = `${node.isFolder ? '0' : '1'}_${label.toLowerCase()}`;
		}
	}

	/** Update a node's aiContext flag. */
	updateAiContext(nodeId: string, aiContext: boolean): void {
		// Update the node data (for context menu label reads)
		const node = this.nodes.get(nodeId);
		if (node) node.aiContext = aiContext;
		// Update the reactive signal (drives template re-renders via isAiPinned)
		const next = new Map(this.aiPins);
		if (aiContext) next.set(nodeId, true);
		else next.delete(nodeId);
		this.aiPins = next;
	}

	/** Check if a node is pinned to AI context. */
	isAiPinned(nodeId: string): boolean {
		return this.aiPins.has(nodeId);
	}
}
