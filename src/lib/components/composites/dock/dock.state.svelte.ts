/**
 * Dock state management (SSR-safe using context pattern).
 * Follows sidebar.svelte.ts pattern: factory + Symbol + get/set context.
 */

import { getContext, setContext } from 'svelte';
import type {
	LayoutNode,
	LeafNode,
	PanelDefinition,
	DragState,
	DropTarget,
	ActivityBarPosition
} from './dock.types';
import {
	findNode,
	findLeafWithPanel,
	replaceNode,
	removePanelFromLeaf,
	addPanelToLeaf,
	splitLeaf,
	getDepth,
	generateId,
	collectLeaves
} from './dock.operations';

const DOCK_CTX = Symbol('dock');
const MAX_DEPTH = 4;

export function createDockState(
	initialRoot: LayoutNode,
	initialPanels: Record<string, PanelDefinition>,
	initialBarPosition: ActivityBarPosition = 'left'
) {
	let root = $state<LayoutNode>(initialRoot);
	let panels = $state<Record<string, PanelDefinition>>({ ...initialPanels });
	let dragState = $state<DragState | null>(null);
	let activityBarPosition = $state<ActivityBarPosition>(initialBarPosition);

	// --- Tab operations ---

	function activateTab(leafId: string, panelId: string): void {
		const leaf = findNode(root, leafId);
		if (!leaf || leaf.type !== 'leaf' || !leaf.tabs.includes(panelId)) return;
		const updated: LeafNode = { ...leaf, activeTab: panelId };
		const newRoot = replaceNode(root, leafId, updated);
		if (newRoot) root = newRoot;
	}

	// --- Close operations ---

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
	}

	// --- Move operations ---

	function movePanel(panelId: string, target: DropTarget): void {
		const sourceLeaf = findLeafWithPanel(root, panelId);
		if (!sourceLeaf) return;

		// Drop on self — no-op
		if (target.leafId === sourceLeaf.id && target.zone === 'center') return;

		// Step 1: Remove from source
		const updatedSource = removePanelFromLeaf(sourceLeaf, panelId);
		let newRoot = replaceNode(root, sourceLeaf.id, updatedSource);
		if (!newRoot) {
			// Tree became empty — create fresh leaf
			root = {
				type: 'leaf',
				id: generateId('leaf'),
				tabs: [panelId],
				activeTab: panelId
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
				} else {
					const split = splitLeaf(targetLeaf, panel.id, target.zone);
					const newRoot = replaceNode(root, target.leafId, split);
					if (newRoot) root = newRoot;
				}
				return;
			}
		}

		// Default: add to first leaf
		const leaves = collectLeaves(root);
		if (leaves.length > 0) {
			const updated = addPanelToLeaf(leaves[0], panel.id);
			const newRoot = replaceNode(root, leaves[0].id, updated);
			if (newRoot) root = newRoot;
		}
	}

	function removePanel(panelId: string): void {
		closePanel(panelId);
		const { [panelId]: _, ...rest } = panels;
		panels = rest;
	}

	// --- Resize ---

	function resizeSplit(splitId: string, sizes: [number, number]): void {
		const node = findNode(root, splitId);
		if (!node || node.type !== 'split') return;
		// Mutate in place — more performant for continuous resize (60fps pointer events).
		node.sizes[0] = sizes[0];
		node.sizes[1] = sizes[1];
	}

	// --- Drag coordination ---

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

	// --- Tab reorder within leaf ---

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

	return {
		get root() { return root; },
		get panels() { return panels; },
		get dragState() { return dragState; },
		get activityBarPosition() { return activityBarPosition; },

		activateTab,
		closePanel,
		movePanel,
		addPanel,
		removePanel,
		resizeSplit,
		reorderTab,

		startDrag,
		updateDragTarget,
		endDrag,
		cancelDrag,

		setActivityBarPosition(pos: ActivityBarPosition) { activityBarPosition = pos; },

		// For persistence
		setRoot(newRoot: LayoutNode) { root = newRoot; },
		setPanels(newPanels: Record<string, PanelDefinition>) { panels = { ...newPanels }; }
	};
}

export type DockState = ReturnType<typeof createDockState>;

export function setDockContext(
	initialRoot: LayoutNode,
	initialPanels: Record<string, PanelDefinition>,
	initialBarPosition?: ActivityBarPosition
): DockState {
	const state = createDockState(initialRoot, initialPanels, initialBarPosition);
	setContext(DOCK_CTX, state);
	return state;
}

export function getDockContext(): DockState {
	return getContext<DockState>(DOCK_CTX);
}
