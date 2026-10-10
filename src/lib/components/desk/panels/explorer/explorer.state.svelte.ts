/**
 * EXPLORER STATE — Reactive flat Map state for the Explorer tree.
 *
 * Stores all nodes (virtual folders, desk folders, files, blog posts, assets)
 * in a flat Map keyed by ID. Parent-child relationships via `parentId` refs.
 * O(1) lookups and moves.
 *
 * `nodes` is DERIVED: the server-confirmed map with the pending optimistic intents
 * folded on top (`explorer-intents.ts` owns the semantics and is unit-tested there).
 * This class is the thin rune wrapper — it holds the two halves and numbers intents.
 */
import { SvelteSet } from 'svelte/reactivity';
import {
	confirmIntent,
	type ExplorerIntent,
	type ExplorerIntentInput,
	type ExplorerNodeMap,
	foldIntents,
	isNoOpIntent,
	rejectIntent,
} from './explorer-intents';
import type { ExplorerNode } from './node';

/** How a confirmed intent settled — `superseded` means the server must be re-read. */
export type IntentConfirmation = 'confirmed' | 'superseded';

export class ExplorerState {
	/** Last server-confirmed nodes. Never speculative. Always replaced, never mutated. */
	#confirmed = $state.raw<ExplorerNodeMap>(new Map());
	/**
	 * In-flight intents in issue order. `$state.raw` is load-bearing: a deep proxy would
	 * hand back proxies of the intents. Entries are matched by `seq` regardless.
	 */
	#pending = $state.raw<ExplorerIntent[]>([]);
	#nextSeq = 0;

	/** Last fold, reused while neither half has been replaced — rows call `getChildren` per render. */
	#shown: { confirmed: ExplorerNodeMap; pending: readonly ExplorerIntent[]; nodes: ExplorerNodeMap } | null = null;

	/**
	 * What the tree shows: confirmed nodes with every pending intent folded on top.
	 *
	 * A memoised getter rather than a `$derived` field: reading both `$state.raw` halves
	 * makes it exactly as reactive in the browser, and it stays correct in the server
	 * compile the unit lane runs, where a class `$derived` is computed once and never again.
	 */
	get nodes(): ExplorerNodeMap {
		const confirmed = this.#confirmed;
		const pending = this.#pending;
		const shown = this.#shown;
		if (shown?.confirmed === confirmed && shown.pending === pending) return shown.nodes;
		const nodes = foldIntents(confirmed, pending);
		this.#shown = { confirmed, pending, nodes };
		return nodes;
	}

	/** A SvelteSet, mutated in place: `$state` does not proxy a Set, so `.add()` on one never re-rendered. */
	readonly expanded = new SvelteSet<string>(['virtual:blog', 'virtual:assets', 'virtual:data']);
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

	/**
	 * Replace the confirmed nodes from fresh API data. Preserves expanded state.
	 * Pending intents are KEPT and re-folded, so an unrelated refresh landing mid-flight
	 * does not make an in-flight move flicker back.
	 */
	setNodes(nodes: ExplorerNode[]): void {
		this.#confirmed = new Map(nodes.map((n) => [n.id, n]));
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
		if (this.expanded.has(nodeId)) this.expanded.delete(nodeId);
		else this.expanded.add(nodeId);
	}

	/**
	 * Show an intent now; returns its `seq` for `confirmIntent`/`rejectIntent`. Returns
	 * null — and records nothing — when the tree already shows the result (a double-drop,
	 * a re-submitted dialog) or the node is gone: there is nothing to send.
	 */
	beginIntent(input: ExplorerIntentInput): number | null {
		if (isNoOpIntent(this.nodes, input)) return null;
		const seq = this.#nextSeq++;
		this.#pending = [...this.#pending, { ...input, seq }];
		return seq;
	}

	/** Move a node to a new parent (optimistic). See `beginIntent`. */
	moveNode(nodeId: string, newParentId: string | null): number | null {
		return this.beginIntent({ kind: 'move', nodeId, parentId: newParentId });
	}

	/** Pin or unpin a node's AI context (optimistic). See `beginIntent`. */
	setAiContext(nodeId: string, aiContext: boolean): number | null {
		return this.beginIntent({ kind: 'ai-context', nodeId, aiContext });
	}

	/** The server accepted intent `seq`. */
	confirmIntent(seq: number): IntentConfirmation {
		const settled = confirmIntent(this.#confirmed, this.#pending, seq);
		// Confirmed first, then pending: the fold never briefly loses the change in between.
		this.#confirmed = settled.confirmed;
		this.#pending = settled.pending;
		return settled.superseded ? 'superseded' : 'confirmed';
	}

	/** The server refused intent `seq` — dropping it is the exact rollback. */
	rejectIntent(seq: number): void {
		this.#pending = rejectIntent(this.#pending, seq);
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

	/** Check if a node is pinned to AI context. */
	isAiPinned(nodeId: string): boolean {
		return this.nodes.get(nodeId)?.aiContext ?? false;
	}
}
