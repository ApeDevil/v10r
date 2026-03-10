import { describe, expect, it } from 'vitest';
import { collectLeaves, getDepth } from './dock.operations';
import { createDockState } from './dock.state.svelte';
import type { LayoutNode, LeafNode, PanelDefinition } from './dock.types';

function leaf(id: string, tabs: string[], activeTab?: string): LeafNode {
	return { type: 'leaf', id, tabs, activeTab: activeTab ?? tabs[0] };
}

function panel(id: string): PanelDefinition {
	return { id, type: 'editor', label: `Panel ${id}` };
}

function makeState(root?: LayoutNode, panels?: Record<string, PanelDefinition>) {
	return createDockState(root ?? leaf('leaf-1', ['p1', 'p2'], 'p1'), panels ?? { p1: panel('p1'), p2: panel('p2') });
}

describe('createDockState', () => {
	describe('activateTab', () => {
		it('switches active tab on correct leaf', () => {
			const state = makeState();
			state.activateTab('leaf-1', 'p2');
			const leaves = collectLeaves(state.root);
			expect(leaves[0].activeTab).toBe('p2');
		});

		it('no-op for nonexistent leaf', () => {
			const state = makeState();
			state.activateTab('missing', 'p1');
			// Should not throw, root unchanged
			expect(collectLeaves(state.root)[0].activeTab).toBe('p1');
		});
	});

	describe('closePanel', () => {
		it('removes panel from tabs', () => {
			const state = makeState();
			state.closePanel('p2');
			const leaves = collectLeaves(state.root);
			expect(leaves[0].tabs).toEqual(['p1']);
		});

		it('updates activeTab when active panel is closed', () => {
			const state = makeState();
			state.closePanel('p1');
			const leaves = collectLeaves(state.root);
			expect(leaves[0].activeTab).toBe('p2');
		});

		it('creates empty leaf placeholder when last panel closed', () => {
			const state = makeState(leaf('leaf-1', ['p1'], 'p1'), { p1: panel('p1') });
			state.closePanel('p1');
			expect(state.root.type).toBe('leaf');
			expect((state.root as LeafNode).tabs).toEqual([]);
		});
	});

	describe('movePanel', () => {
		it('center drop adds as tab', () => {
			const root: LayoutNode = {
				type: 'split',
				id: 's1',
				direction: 'horizontal',
				children: [leaf('leaf-1', ['p1'], 'p1'), leaf('leaf-2', ['p2'], 'p2')],
				sizes: [50, 50],
			};
			const state = makeState(root, { p1: panel('p1'), p2: panel('p2') });

			state.movePanel('p1', { leafId: 'leaf-2', zone: 'center' });
			// p1 should now be in leaf-2
			const leaves = collectLeaves(state.root);
			const targetLeaf = leaves.find((l) => l.tabs.includes('p1') && l.tabs.includes('p2'));
			expect(targetLeaf).toBeTruthy();
		});

		it('edge drop creates split', () => {
			const root: LayoutNode = {
				type: 'split',
				id: 's1',
				direction: 'horizontal',
				children: [leaf('leaf-1', ['p1'], 'p1'), leaf('leaf-2', ['p2'], 'p2')],
				sizes: [50, 50],
			};
			const state = makeState(root, { p1: panel('p1'), p2: panel('p2') });

			state.movePanel('p1', { leafId: 'leaf-2', zone: 'right' });
			// Should have created a new split
			expect(getDepth(state.root)).toBeGreaterThanOrEqual(1);
		});

		it('MAX_DEPTH guard falls back to tab insert', () => {
			// Create a deeply nested tree (depth 4)
			// l0 has TWO tabs so removing q0 doesn't collapse the tree
			let node: LayoutNode = leaf('d4', ['p5'], 'p5');
			for (let i = 3; i >= 1; i--) {
				node = {
					type: 'split',
					id: `s${i}`,
					direction: 'horizontal',
					children: [leaf(`l${i}`, [`q${i}`], `q${i}`), node],
					sizes: [50, 50],
				};
			}
			node = {
				type: 'split',
				id: 's0',
				direction: 'horizontal',
				children: [leaf('l0', ['q0', 'extra'], 'q0'), node],
				sizes: [50, 50],
			};

			const panels: Record<string, PanelDefinition> = {};
			for (let i = 0; i <= 4; i++) panels[`q${i}`] = panel(`q${i}`);
			panels.p5 = panel('p5');
			panels.extra = panel('extra');

			const state = makeState(node, panels);

			// depth is 4 and stays 4 after removing q0 (l0 still has 'extra')
			// Edge drop should fallback to tab insert
			state.movePanel('q0', { leafId: 'd4', zone: 'right' });
			const leaves = collectLeaves(state.root);
			const hasQ0AsTab = leaves.some((l) => l.tabs.includes('q0') && l.tabs.includes('p5'));
			expect(hasQ0AsTab).toBe(true);
		});
	});

	describe('addPanel', () => {
		it('adds to registry and tree', () => {
			const state = makeState();
			state.addPanel(panel('p3'));
			expect(state.panels.p3).toBeDefined();
			const leaves = collectLeaves(state.root);
			const hasP3 = leaves.some((l) => l.tabs.includes('p3'));
			expect(hasP3).toBe(true);
		});
	});

	describe('removePanel', () => {
		it('removes from both tree and registry', () => {
			const state = makeState();
			state.removePanel('p2');
			expect(state.panels.p2).toBeUndefined();
			const leaves = collectLeaves(state.root);
			const hasP2 = leaves.some((l) => l.tabs.includes('p2'));
			expect(hasP2).toBe(false);
		});
	});

	describe('reorderTab', () => {
		it('moves tab to new index', () => {
			const state = makeState(leaf('leaf-1', ['p1', 'p2', 'p3'], 'p1'), {
				p1: panel('p1'),
				p2: panel('p2'),
				p3: panel('p3'),
			});

			state.reorderTab('leaf-1', 'p1', 2);
			const leaves = collectLeaves(state.root);
			expect(leaves[0].tabs).toEqual(['p2', 'p3', 'p1']);
		});
	});

	describe('drag workflow', () => {
		it('startDrag → updateDragTarget → endDrag', () => {
			const root: LayoutNode = {
				type: 'split',
				id: 's1',
				direction: 'horizontal',
				children: [leaf('leaf-1', ['p1'], 'p1'), leaf('leaf-2', ['p2'], 'p2')],
				sizes: [50, 50],
			};
			const state = makeState(root, { p1: panel('p1'), p2: panel('p2') });

			state.startDrag('p1', 'leaf-1');
			expect(state.dragState).toBeTruthy();
			expect(state.dragState?.panelId).toBe('p1');

			state.updateDragTarget({ leafId: 'leaf-2', zone: 'center' });
			expect(state.dragState?.target).toEqual({ leafId: 'leaf-2', zone: 'center' });

			state.endDrag();
			expect(state.dragState).toBeNull();

			// Panel should have moved
			const leaves = collectLeaves(state.root);
			const leaf2 = leaves.find((l) => l.tabs.includes('p1'));
			expect(leaf2).toBeTruthy();
		});
	});
});
