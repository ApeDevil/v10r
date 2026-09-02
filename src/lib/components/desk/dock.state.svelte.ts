/**
 * Dock state management (SSR-safe using context pattern).
 * Follows sidebar.svelte.ts pattern: factory + Symbol + get/set context.
 */

import { getContext, setContext } from 'svelte';
import type {
	ActivityBarPosition,
	DragState,
	DropTarget,
	LayoutNode,
	LeafNode,
	PanelDefinition,
} from '$lib/desk/layout.types';
import {
	addPanelToLeaf,
	collectLeaves,
	findLeafWithPanel,
	findNode,
	generateId,
	getDepth,
	hasPanelType,
	removePanelFromLeaf,
	replaceNode,
	splitLeaf,
} from './dock.operations';

const DOCK_CTX = Symbol('dock');
const MAX_DEPTH = 4;

export interface DockStateHooks {
	/** Fires after a panel leaves the tree (any close path). Host wires undo UX. */
	onPanelClosed?: (panel: PanelDefinition) => void;
}

export function createDockState(
	initialRoot: LayoutNode,
	initialPanels: Record<string, PanelDefinition>,
	initialBarPosition: ActivityBarPosition = 'left',
	initialFocusedLeafId: string | null = null,
	hooks: DockStateHooks = {},
) {
	let root = $state<LayoutNode>(initialRoot);
	let panels = $state<Record<string, PanelDefinition>>({ ...initialPanels });
	let dragState = $state<DragState | null>(null);
	let activityBarPosition = $state<ActivityBarPosition>(initialBarPosition);
	// Raw stored focus — may go stale (closed leaf, workspace switch). Consumers
	// read the TOTAL derivation below, never this directly.
	let focusedLeafId = $state<string | null>(initialFocusedLeafId);
	// Monotonic focus-request counter. Bumped on every setFocusedLeaf CALL (even a
	// repeat of the current leaf) so "surface this panel" is observable when the
	// target is already focused — the mobile overlay auto-close depends on it.
	let focusSeq = $state(0);

	// Total while any panel is open: stored leaf if it still resolves, else the
	// first non-empty leaf, else null. Keeps focus meaningful after closes and
	// workspace switches without every consumer re-implementing the fallback.
	// A plain function, not $derived: server-mode compilation (SSR, node tests)
	// evaluates $derived once and freezes it; reading the $state sources inside
	// the getters gives consumers the same fine-grained tracking in the browser.
	function resolveFocusedLeaf(): LeafNode | null {
		if (focusedLeafId) {
			const node = findNode(root, focusedLeafId);
			if (node && node.type === 'leaf' && node.tabs.length > 0) return node;
		}
		return collectLeaves(root).find((leaf) => leaf.tabs.length > 0) ?? null;
	}

	function activateTab(leafId: string, panelId: string): void {
		const leaf = findNode(root, leafId);
		if (!leaf || leaf.type !== 'leaf' || !leaf.tabs.includes(panelId)) return;
		// Idempotent: re-activating the active tab must not reassign root, or
		// every $effect that both reads the tree and activates would loop.
		if (leaf.activeTab === panelId) return;
		const updated: LeafNode = { ...leaf, activeTab: panelId };
		const newRoot = replaceNode(root, leafId, updated);
		if (newRoot) root = newRoot;
	}

	function closePanel(panelId: string): void {
		const leaf = findLeafWithPanel(root, panelId);
		if (!leaf) return;

		const updatedLeaf = removePanelFromLeaf(leaf, panelId);
		const newRoot = replaceNode(root, leaf.id, updatedLeaf);
		if (newRoot) {
			root = newRoot;
		} else {
			// Tree is now empty — create empty leaf placeholder
			root = { type: 'leaf', id: generateId('leaf'), tabs: [], activeTab: '' };
		}
		// Don't remove from panels registry — allows re-adding via activity bar
		// (and makes onPanelClosed undo a plain addPanel of the same definition).
		const closed = panels[panelId];
		if (closed) hooks.onPanelClosed?.(closed);
	}

	function movePanel(panelId: string, target: DropTarget): void {
		const sourceLeaf = findLeafWithPanel(root, panelId);
		if (!sourceLeaf) return;

		// Drop on self — no-op
		if (target.leafId === sourceLeaf.id && target.zone === 'center') return;

		// Step 1: Remove from source
		const updatedSource = removePanelFromLeaf(sourceLeaf, panelId);
		const newRoot = replaceNode(root, sourceLeaf.id, updatedSource);
		if (!newRoot) {
			// Tree became empty — create fresh leaf
			root = {
				type: 'leaf',
				id: generateId('leaf'),
				tabs: [panelId],
				activeTab: panelId,
			};
			return;
		}

		// Step 2: Insert at target
		const targetLeaf = findNode(newRoot, target.leafId) as LeafNode | null;
		if (!targetLeaf || targetLeaf.type !== 'leaf') {
			root = newRoot;
			return;
		}

		if (target.zone === 'center') {
			const updated = addPanelToLeaf(targetLeaf, panelId);
			const result = replaceNode(newRoot, target.leafId, updated);
			if (result) root = result;
		} else {
			// Edge drop — create split (unless too deep)
			if (getDepth(newRoot) >= MAX_DEPTH) {
				// Fallback: add as tab instead
				const updated = addPanelToLeaf(targetLeaf, panelId);
				const result = replaceNode(newRoot, target.leafId, updated);
				if (result) root = result;
			} else {
				const split = splitLeaf(targetLeaf, panelId, target.zone);
				const result = replaceNode(newRoot, target.leafId, split);
				if (result) root = result;
			}
		}
	}

	function addPanel(panel: PanelDefinition, target?: DropTarget): void {
		panels = { ...panels, [panel.id]: panel };

		if (target) {
			const targetLeaf = findNode(root, target.leafId);
			if (targetLeaf && targetLeaf.type === 'leaf') {
				if (target.zone === 'center') {
					const updated = addPanelToLeaf(targetLeaf, panel.id);
					const newRoot = replaceNode(root, target.leafId, updated);
					if (newRoot) root = newRoot;
					setFocusedLeaf(target.leafId);
				} else {
					const split = splitLeaf(targetLeaf, panel.id, target.zone);
					const newRoot = replaceNode(root, target.leafId, split);
					if (newRoot) root = newRoot;
					// The new panel lives in the split's freshly minted leaf.
					const newLeaf = findLeafWithPanel(root, panel.id);
					if (newLeaf) setFocusedLeaf(newLeaf.id);
				}
				return;
			}
		}

		// Default: add to first leaf. Focusing the insertion leaf is load-bearing:
		// the mobile visible panel derives from focus, so an added panel surfaces
		// on every surface without any auto-surface diffing machinery.
		const leaves = collectLeaves(root);
		if (leaves.length > 0) {
			const updated = addPanelToLeaf(leaves[0], panel.id);
			const newRoot = replaceNode(root, leaves[0].id, updated);
			if (newRoot) root = newRoot;
			setFocusedLeaf(leaves[0].id);
		}
	}

	function removePanel(panelId: string): void {
		closePanel(panelId);
		const { [panelId]: _, ...rest } = panels;
		panels = rest;
	}

	function resizeSplit(splitId: string, sizes: [number, number]): void {
		const node = findNode(root, splitId);
		if (!node || node.type !== 'split') return;
		// Mutate in place — more performant for continuous resize (60fps pointer events).
		node.sizes[0] = sizes[0];
		node.sizes[1] = sizes[1];
	}

	function startDrag(panelId: string, sourceLeafId: string): void {
		dragState = { panelId, sourceLeafId, target: null };
	}

	function updateDragTarget(target: DropTarget | null): void {
		if (!dragState) return;
		dragState = { ...dragState, target };
	}

	function endDrag(): void {
		if (dragState?.target) {
			movePanel(dragState.panelId, dragState.target);
		}
		dragState = null;
	}

	function cancelDrag(): void {
		dragState = null;
	}

	// Tab reorder within leaf

	function reorderTab(leafId: string, panelId: string, toIndex: number): void {
		const leaf = findNode(root, leafId);
		if (!leaf || leaf.type !== 'leaf') return;

		const fromIndex = leaf.tabs.indexOf(panelId);
		if (fromIndex === -1 || fromIndex === toIndex) return;

		const tabs = [...leaf.tabs];
		tabs.splice(fromIndex, 1);
		tabs.splice(toIndex, 0, panelId);

		const updated: LeafNode = { ...leaf, tabs };
		const newRoot = replaceNode(root, leafId, updated);
		if (newRoot) root = newRoot;
	}

	/** Ensure a panel of the given type is open and focused. If absent, create one. */
	function ensurePanelType(panelType: string, label?: string, icon?: string): void {
		if (hasPanelType(root, panelType, panels)) {
			const leaves = collectLeaves(root);
			for (const leaf of leaves) {
				for (const tabId of leaf.tabs) {
					if (panels[tabId]?.type === panelType) {
						activateTab(leaf.id, tabId);
						setFocusedLeaf(leaf.id);
						return;
					}
				}
			}
			return;
		}
		// Not in layout — add it
		const panel: PanelDefinition = {
			id: `${panelType}-${Date.now()}`,
			type: panelType,
			label: label ?? panelType,
			icon,
			closable: true,
		};
		addPanel(panel);
	}

	function setFocusedLeaf(leafId: string): void {
		focusSeq++;
		if (focusedLeafId === leafId) return;
		focusedLeafId = leafId;
	}

	function updatePanel(panelId: string, partial: Partial<PanelDefinition>): void {
		const existing = panels[panelId];
		if (!existing) return;
		// Avoid unnecessary reactive updates
		const changed = Object.entries(partial).some(([k, v]) => existing[k as keyof PanelDefinition] !== v);
		if (!changed) return;
		panels = { ...panels, [panelId]: { ...existing, ...partial } };
	}

	function closeOtherPanels(leafId: string, keepPanelId: string): void {
		const leaf = findNode(root, leafId);
		if (!leaf || leaf.type !== 'leaf') return;
		for (const tabId of leaf.tabs) {
			if (tabId !== keepPanelId) closePanel(tabId);
		}
	}

	function closeAllPanels(leafId: string): void {
		const leaf = findNode(root, leafId);
		if (!leaf || leaf.type !== 'leaf') return;
		for (const tabId of [...leaf.tabs]) {
			closePanel(tabId);
		}
	}

	return {
		get root() {
			return root;
		},
		get panels() {
			return panels;
		},
		get dragState() {
			return dragState;
		},
		get activityBarPosition() {
			return activityBarPosition;
		},
		/** Effective focused leaf id (total — falls back to the first non-empty leaf). */
		get focusedLeafId() {
			return resolveFocusedLeaf()?.id ?? null;
		},
		/** The panelId of the active tab in the focused leaf (total while panels exist). */
		get focusedPanelId(): string | null {
			return resolveFocusedLeaf()?.activeTab || null;
		},
		/** Focus-request counter — changes on every setFocusedLeaf call, repeats included. */
		get focusSeq() {
			return focusSeq;
		},

		activateTab,
		closePanel,
		closeOtherPanels,
		closeAllPanels,
		movePanel,
		addPanel,
		removePanel,
		updatePanel,
		ensurePanelType,
		resizeSplit,
		reorderTab,

		startDrag,
		updateDragTarget,
		endDrag,
		cancelDrag,

		setFocusedLeaf,
		setActivityBarPosition(pos: ActivityBarPosition) {
			activityBarPosition = pos;
		},

		// For persistence
		setRoot(newRoot: LayoutNode) {
			root = newRoot;
		},
		setPanels(newPanels: Record<string, PanelDefinition>) {
			panels = { ...newPanels };
		},
	};
}

export type DockState = ReturnType<typeof createDockState>;

export function setDockContext(
	initialRoot: LayoutNode,
	initialPanels: Record<string, PanelDefinition>,
	initialBarPosition?: ActivityBarPosition,
	initialFocusedLeafId?: string | null,
	hooks?: DockStateHooks,
): DockState {
	const state = createDockState(initialRoot, initialPanels, initialBarPosition, initialFocusedLeafId ?? null, hooks);
	setContext(DOCK_CTX, state);
	return state;
}

export function getDockContext(): DockState {
	return getContext<DockState>(DOCK_CTX);
}
