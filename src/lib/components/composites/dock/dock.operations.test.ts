import { describe, expect, it } from 'vitest';
import {
	addPanelToLeaf,
	collectLeaves,
	findLeafWithPanel,
	findNode,
	getDepth,
	removePanelFromLeaf,
	replaceNode,
	resolveDropZone,
	splitLeaf,
} from './dock.operations';
import type { LayoutNode, LeafNode, SplitNode } from './dock.types';

// --- Helpers ---

function leaf(id: string, tabs: string[], activeTab?: string): LeafNode {
	return { type: 'leaf', id, tabs, activeTab: activeTab ?? tabs[0] };
}

function split(id: string, direction: 'horizontal' | 'vertical', children: [LayoutNode, LayoutNode]): SplitNode {
	return { type: 'split', id, direction, children, sizes: [50, 50] };
}

// --- Tests ---

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
		const result = removePanelFromLeaf(l, 'p2')!;
		expect(result.tabs).toEqual(['p1', 'p3']);
		expect(result.activeTab).toBe('p1');
	});

	it('updates activeTab when active panel is removed', () => {
		const l = leaf('a', ['p1', 'p2'], 'p1');
		const result = removePanelFromLeaf(l, 'p1')!;
		expect(result.activeTab).toBe('p2');
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
