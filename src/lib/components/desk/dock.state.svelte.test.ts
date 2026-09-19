/**
 * The dock: layout algebra, the reducer over it, and focus.
 *
 * These were three files over one subject at three altitudes, each re-declaring the
 * same `leaf()` / `panel()` factories — `dock.state.svelte.test.ts` already imported
 * `collectLeaves`/`getDepth` from `dock.operations` to make its own assertions, so the
 * boundary between them was already blurred.
 *
 * Two split helpers survive on purpose: `split()` takes an explicit direction (the
 * algebra cares), `hsplit()` is the horizontal shorthand the focus cases read better with.
 */
import { describe, expect, it } from 'vitest';
import type { ActivityBarItem, LayoutNode, LeafNode, PanelDefinition, SplitNode } from '$lib/desk/layout.types';
import {
	addPanelToLeaf,
	collectLeaves,
	findLeafWithPanel,
	findNode,
	getDepth,
	nextPanelOfType,
	removePanelFromLeaf,
	replaceNode,
	resolveDropZone,
	splitLeaf,
} from './dock.operations';
import { createDockState } from './dock.state.svelte';
import { fileIdOfPanel } from './file-panel';
import { duplicatePanel, focusPanel, openOrCycle, splitFocused, togglePanelType } from './panel-actions';

function leaf(id: string, tabs: string[], activeTab?: string): LeafNode {
	return { type: 'leaf', id, tabs, activeTab: activeTab ?? tabs[0] ?? '' };
}

function split(id: string, direction: 'horizontal' | 'vertical', children: [LayoutNode, LayoutNode]): SplitNode {
	return { type: 'split', id, direction, children, sizes: [50, 50] };
}

function hsplit(id: string, a: LayoutNode, b: LayoutNode): LayoutNode {
	return split(id, 'horizontal', [a, b]);
}

function panel(id: string, type = 'editor'): PanelDefinition {
	return { id, type, label: `Panel ${id}` };
}

function makeState(root?: LayoutNode, panels?: Record<string, PanelDefinition>) {
	return createDockState(root ?? leaf('leaf-1', ['p1', 'p2'], 'p1'), panels ?? { p1: panel('p1'), p2: panel('p2') });
}

describe('findNode', () => {
	it('finds root node', () => {
		const root = leaf('a', ['p1']);
		expect(findNode(root, 'a')).toBe(root);
	});

	it('finds nested node in split tree', () => {
		const child = leaf('b', ['p2']);
		const root = split('s1', 'horizontal', [leaf('a', ['p1']), child]);
		expect(findNode(root, 'b')).toBe(child);
	});

	it('returns null for missing ID', () => {
		const root = leaf('a', ['p1']);
		expect(findNode(root, 'missing')).toBeNull();
	});
});

describe('findLeafWithPanel', () => {
	it('finds leaf containing panel ID', () => {
		const target = leaf('a', ['p1', 'p2']);
		const root = split('s1', 'horizontal', [target, leaf('b', ['p3'])]);
		expect(findLeafWithPanel(root, 'p2')).toBe(target);
	});

	it('returns null when panel not in tree', () => {
		const root = leaf('a', ['p1']);
		expect(findLeafWithPanel(root, 'missing')).toBeNull();
	});
});

describe('replaceNode', () => {
	it('replaces root node', () => {
		const root = leaf('a', ['p1']);
		const replacement = leaf('b', ['p2']);
		expect(replaceNode(root, 'a', replacement)).toBe(replacement);
	});

	it('replaces child in split and returns new tree', () => {
		const root = split('s1', 'horizontal', [leaf('a', ['p1']), leaf('b', ['p2'])]);
		const replacement = leaf('c', ['p3']);
		const result = replaceNode(root, 'b', replacement) as SplitNode;
		expect(result.children[1]).toBe(replacement);
		expect(result.children[0].id).toBe('a');
	});

	it('promotes sibling when child is removed (null replacement)', () => {
		const sibling = leaf('a', ['p1']);
		const root = split('s1', 'horizontal', [sibling, leaf('b', ['p2'])]);
		const result = replaceNode(root, 'b', null);
		expect(result).toBe(sibling);
	});

	it('returns null when removing root', () => {
		const root = leaf('a', ['p1']);
		expect(replaceNode(root, 'a', null)).toBeNull();
	});
});

describe('removePanelFromLeaf', () => {
	it('removes tab and returns updated leaf', () => {
		const l = leaf('a', ['p1', 'p2', 'p3'], 'p1');
		const result = removePanelFromLeaf(l, 'p2');
		expect(result?.tabs).toEqual(['p1', 'p3']);
		expect(result?.activeTab).toBe('p1');
	});

	it('updates activeTab when active panel is removed', () => {
		const l = leaf('a', ['p1', 'p2'], 'p1');
		const result = removePanelFromLeaf(l, 'p1');
		expect(result?.activeTab).toBe('p2');
	});

	it('returns null when leaf becomes empty', () => {
		const l = leaf('a', ['p1'], 'p1');
		expect(removePanelFromLeaf(l, 'p1')).toBeNull();
	});
});

describe('addPanelToLeaf', () => {
	it('adds new tab and activates it', () => {
		const l = leaf('a', ['p1'], 'p1');
		const result = addPanelToLeaf(l, 'p2');
		expect(result.tabs).toEqual(['p1', 'p2']);
		expect(result.activeTab).toBe('p2');
	});

	it('activates existing tab without duplicating', () => {
		const l = leaf('a', ['p1', 'p2'], 'p1');
		const result = addPanelToLeaf(l, 'p2');
		expect(result.tabs).toEqual(['p1', 'p2']);
		expect(result.activeTab).toBe('p2');
	});
});

describe('splitLeaf', () => {
	it('creates horizontal split for left zone', () => {
		const l = leaf('a', ['p1']);
		const result = splitLeaf(l, 'p2', 'left');
		expect(result.type).toBe('split');
		expect(result.direction).toBe('horizontal');
		expect(result.children[0].type).toBe('leaf');
		expect((result.children[0] as LeafNode).tabs).toEqual(['p2']);
		expect(result.children[1]).toBe(l);
	});

	it('creates horizontal split for right zone', () => {
		const l = leaf('a', ['p1']);
		const result = splitLeaf(l, 'p2', 'right');
		expect(result.direction).toBe('horizontal');
		expect(result.children[0]).toBe(l);
		expect((result.children[1] as LeafNode).tabs).toEqual(['p2']);
	});

	it('creates vertical split for top zone', () => {
		const l = leaf('a', ['p1']);
		const result = splitLeaf(l, 'p2', 'top');
		expect(result.direction).toBe('vertical');
		expect((result.children[0] as LeafNode).tabs).toEqual(['p2']);
	});

	it('creates vertical split for bottom zone', () => {
		const l = leaf('a', ['p1']);
		const result = splitLeaf(l, 'p2', 'bottom');
		expect(result.direction).toBe('vertical');
		expect((result.children[1] as LeafNode).tabs).toEqual(['p2']);
	});
});

describe('getDepth', () => {
	it('returns 0 for a leaf', () => {
		expect(getDepth(leaf('a', ['p1']))).toBe(0);
	});

	it('returns 1 for a single split', () => {
		const root = split('s1', 'horizontal', [leaf('a', ['p1']), leaf('b', ['p2'])]);
		expect(getDepth(root)).toBe(1);
	});

	it('counts nested splits', () => {
		const inner = split('s2', 'vertical', [leaf('c', ['p3']), leaf('d', ['p4'])]);
		const root = split('s1', 'horizontal', [leaf('a', ['p1']), inner]);
		expect(getDepth(root)).toBe(2);
	});
});

describe('collectLeaves', () => {
	it('returns single leaf in array', () => {
		const l = leaf('a', ['p1']);
		expect(collectLeaves(l)).toEqual([l]);
	});

	it('flattens tree to all leaves', () => {
		const a = leaf('a', ['p1']);
		const b = leaf('b', ['p2']);
		const c = leaf('c', ['p3']);
		const inner = split('s2', 'vertical', [b, c]);
		const root = split('s1', 'horizontal', [a, inner]);
		expect(collectLeaves(root)).toEqual([a, b, c]);
	});
});

describe('resolveDropZone', () => {
	const rect = { left: 0, top: 0, width: 100, height: 100 };

	it('returns top for y < 20%', () => {
		expect(resolveDropZone(rect, 50, 10)).toBe('top');
	});

	it('returns bottom for y > 80%', () => {
		expect(resolveDropZone(rect, 50, 90)).toBe('bottom');
	});

	it('returns left for x < 20%', () => {
		expect(resolveDropZone(rect, 10, 50)).toBe('left');
	});

	it('returns right for x > 80%', () => {
		expect(resolveDropZone(rect, 90, 50)).toBe('right');
	});

	it('returns center for middle area', () => {
		expect(resolveDropZone(rect, 50, 50)).toBe('center');
	});

	it('uses 20% edge threshold', () => {
		// Exactly at threshold boundary — 20% of 100 = 20
		expect(resolveDropZone(rect, 50, 19)).toBe('top');
		expect(resolveDropZone(rect, 50, 21)).toBe('center');
	});
});

describe('nextPanelOfType', () => {
	const panels = {
		'editor-1': { id: 'editor-1', type: 'editor', label: 'Editor' },
		'editor-2': { id: 'editor-2', type: 'editor', label: 'Editor' },
		'explorer-1': { id: 'explorer-1', type: 'explorer', label: 'Explorer' },
	};
	const root: LayoutNode = {
		type: 'split',
		id: 's1',
		direction: 'horizontal',
		sizes: [50, 50],
		children: [leaf('l1', ['explorer-1', 'editor-1']), leaf('l2', ['editor-2'])],
	};

	it('returns the first instance when nothing is current', () => {
		expect(nextPanelOfType(root, panels, 'editor', null)).toBe('editor-1');
	});

	it('cycles to the next instance and wraps around', () => {
		expect(nextPanelOfType(root, panels, 'editor', 'editor-1')).toBe('editor-2');
		expect(nextPanelOfType(root, panels, 'editor', 'editor-2')).toBe('editor-1');
	});

	it('ignores a currentId of a different type', () => {
		expect(nextPanelOfType(root, panels, 'editor', 'explorer-1')).toBe('editor-1');
	});

	it('returns null when the type has no open instances', () => {
		expect(nextPanelOfType(root, panels, 'bot', null)).toBe(null);
	});
});

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

const ITEMS: ActivityBarItem[] = [
	{ panelType: 'editor', icon: 'i-lucide-pen-line', label: 'Editor' },
	{ panelType: 'preview', icon: 'i-lucide-eye', label: 'Preview' },
];

function makeTwoLeafState() {
	return createDockState(hsplit('root', leaf('l1', ['p1']), leaf('l2', ['p2', 'p3'], 'p2')), {
		p1: panel('p1'),
		p2: panel('p2'),
		p3: panel('p3', 'preview'),
	});
}

describe('total focus derivation', () => {
	it('falls back to the first non-empty leaf when nothing was focused', () => {
		const state = makeTwoLeafState();
		expect(state.focusedLeafId).toBe('l1');
		expect(state.focusedPanelId).toBe('p1');
	});

	it('restores a persisted focused leaf', () => {
		const state = createDockState(
			hsplit('root', leaf('l1', ['p1']), leaf('l2', ['p2'])),
			{ p1: panel('p1'), p2: panel('p2') },
			'left',
			'l2',
		);
		expect(state.focusedLeafId).toBe('l2');
		expect(state.focusedPanelId).toBe('p2');
	});

	it('falls back when the stored leaf leaves the tree', () => {
		const state = makeTwoLeafState();
		state.setFocusedLeaf('l2');
		state.closePanel('p2');
		state.closePanel('p3'); // l2 empties and collapses away
		expect(state.focusedLeafId).toBe('l1');
		expect(state.focusedPanelId).toBe('p1');
	});

	it('returns null only when no panel is open', () => {
		const state = createDockState(leaf('l1', ['p1']), { p1: panel('p1') });
		state.closePanel('p1');
		expect(state.focusedPanelId).toBeNull();
		expect(state.focusedLeafId).toBeNull();
	});
});

describe('focusSeq', () => {
	it('bumps on every setFocusedLeaf call, repeats included', () => {
		const state = makeTwoLeafState();
		const before = state.focusSeq;
		state.setFocusedLeaf('l1');
		state.setFocusedLeaf('l1');
		expect(state.focusSeq).toBe(before + 2);
	});
});

describe('focus-on-insert', () => {
	it('addPanel focuses the insertion leaf', () => {
		const state = makeTwoLeafState();
		state.setFocusedLeaf('l2');
		state.addPanel(panel('p4'));
		// default insert goes to the first leaf — focus follows the insertion
		expect(state.focusedLeafId).toBe('l1');
		expect(state.focusedPanelId).toBe('p4');
	});

	it('addPanel with a split target focuses the new leaf', () => {
		const state = makeTwoLeafState();
		state.addPanel(panel('p5'), { leafId: 'l2', zone: 'right' });
		expect(state.focusedPanelId).toBe('p5');
	});

	it('ensurePanelType focuses an existing instance', () => {
		const state = makeTwoLeafState();
		state.ensurePanelType('preview');
		expect(state.focusedPanelId).toBe('p3');
	});
});

describe('activateTab idempotence', () => {
	it('re-activating the active tab does not reassign root', () => {
		const state = makeTwoLeafState();
		const rootBefore = state.root;
		state.activateTab('l2', 'p2');
		expect(state.root).toBe(rootBefore);
	});
});

describe('panel-actions', () => {
	it('focusPanel activates + focuses and reports presence', () => {
		const state = makeTwoLeafState();
		expect(focusPanel(state, 'p3')).toBe(true);
		expect(state.focusedPanelId).toBe('p3');
		expect(focusPanel(state, 'nope')).toBe(false);
	});

	it('focusPanel is idempotent', () => {
		const state = makeTwoLeafState();
		focusPanel(state, 'p3');
		const rootBefore = state.root;
		focusPanel(state, 'p3');
		expect(state.root).toBe(rootBefore);
		expect(state.focusedPanelId).toBe('p3');
	});

	it('openOrCycle cycles between instances of a type', () => {
		const state = makeTwoLeafState();
		focusPanel(state, 'p1'); // editor
		openOrCycle(state, ITEMS, 'editor'); // next editor instance is p2
		expect(state.focusedPanelId).toBe('p2');
		openOrCycle(state, ITEMS, 'editor'); // wraps back
		expect(state.focusedPanelId).toBe('p1');
	});

	it('openOrCycle creates a panel when the type is absent — never closes', () => {
		const state = createDockState(leaf('l1', ['p1']), { p1: panel('p1') });
		openOrCycle(state, ITEMS, 'preview');
		expect(state.focusedPanelId).toMatch(/^preview-/);
		// tapping again just keeps the single instance focused
		openOrCycle(state, ITEMS, 'preview');
		expect(Object.values(state.panels).filter((p) => p.type === 'preview')).toHaveLength(1);
	});

	it('togglePanelType closes all instances of an open type (desktop semantics)', () => {
		const state = makeTwoLeafState();
		const editorIds = Object.values(state.panels)
			.filter((p) => p.type === 'editor')
			.map((p) => p.id);
		expect(editorIds.length).toBeGreaterThan(0);

		togglePanelType(state, 'editor');

		// The definitions survive for undo; what must be gone is every editor TAB.
		const openTabs = collectLeaves(state.root).flatMap((l) => l.tabs);
		expect(openTabs.filter((id) => editorIds.includes(id))).toEqual([]);
		expect(state.focusedPanelId).toBe('p3');
	});
});

describe('unsaved-close guard', () => {
	function unsavedState() {
		return createDockState(leaf('l1', ['p1', 'p2', 'p3'], 'p1'), {
			p1: { ...panel('p1'), indicator: 'unsaved' },
			p2: panel('p2'),
			p3: { ...panel('p3'), indicator: 'unsaved' },
		});
	}

	it('closes a saved panel immediately and holds an unsaved one behind a confirm', () => {
		const state = unsavedState();
		state.requestClose('p2');
		expect(state.pendingClose).toBeNull();
		expect(collectLeaves(state.root)[0].tabs).toEqual(['p1', 'p3']);

		state.requestClose('p1');
		expect(state.pendingClose?.panels.map((p) => p.id)).toEqual(['p1']);
		expect(collectLeaves(state.root)[0].tabs).toEqual(['p1', 'p3']);

		state.cancelPendingClose();
		expect(state.pendingClose).toBeNull();
		expect(collectLeaves(state.root)[0].tabs).toEqual(['p1', 'p3']);

		state.requestClose('p1');
		state.confirmPendingClose();
		expect(state.pendingClose).toBeNull();
		expect(collectLeaves(state.root)[0].tabs).toEqual(['p3']);
	});

	it('prompts once for a batch, listing only the unsaved panels, then runs the whole close', () => {
		const state = unsavedState();
		state.requestClosePanels(['p1', 'p2', 'p3'], () => state.closeAllPanels('l1'));
		expect(state.pendingClose?.panels.map((p) => p.id)).toEqual(['p1', 'p3']);
		state.confirmPendingClose();
		expect(collectLeaves(state.root)[0].tabs).toEqual([]);
	});

	it('togglePanelType asks the guard before closing a type (the activity bar can hit an unsaved editor)', () => {
		const state = unsavedState();
		togglePanelType(state, 'editor');
		expect(state.pendingClose?.panels.map((p) => p.id)).toEqual(['p1', 'p3']);
		expect(collectLeaves(state.root)[0].tabs).toEqual(['p1', 'p2', 'p3']);
		state.confirmPendingClose();
		expect(collectLeaves(state.root)[0].tabs).toEqual([]);
	});
});

describe('onPanelClosed hook', () => {
	it('fires with the closed definition on every close path', () => {
		const closed: string[] = [];
		const state = createDockState(leaf('l1', ['p1', 'p2']), { p1: panel('p1'), p2: panel('p2') }, 'left', null, {
			onPanelClosed: (p) => closed.push(p.id),
		});
		state.closePanel('p1');
		state.closeAllPanels('l1');
		expect(closed).toEqual(['p1', 'p2']);
	});
});

describe('duplicatePanel', () => {
	it('splits a file panel into a twin that names the same file, in the zone beside its leaf', () => {
		const state = createDockState(leaf('l1', ['editor-pst_abc'], 'editor-pst_abc'), {
			'editor-pst_abc': { ...panel('editor-pst_abc'), meta: { fileId: 'pst_abc' } },
		});
		duplicatePanel(state, 'editor-pst_abc', 'right');
		const leaves = collectLeaves(state.root);
		expect(leaves).toHaveLength(2);
		const twinId = leaves[1].tabs[0];
		// The suffixed form fileIdOfPanel reads — the twin loads the same post, not an empty editor.
		expect(twinId).toMatch(/^editor-pst_abc-\d+$/);
		expect(fileIdOfPanel(twinId)).toBe('pst_abc');
		expect(state.panels[twinId]?.meta).toEqual({ fileId: 'pst_abc' });
		expect(state.panels[twinId]?.label).toBe('Panel editor-pst_abc');
	});

	it('gives a non-file panel a plain typed id, and splitFocused acts on the focused panel', () => {
		const state = createDockState(leaf('l1', ['p1'], 'p1'), { p1: panel('p1', 'explorer') }, 'left', 'l1');
		splitFocused(state, 'bottom');
		const leaves = collectLeaves(state.root);
		expect(leaves).toHaveLength(2);
		expect(leaves[1].tabs[0]).toMatch(/^explorer-\d+$/);
		expect(fileIdOfPanel(leaves[1].tabs[0])).toBeNull();
	});
});
