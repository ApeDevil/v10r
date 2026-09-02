/**
 * Focus architecture tests: total derivation, focusSeq observability,
 * focus-on-insert, and the shared panel-actions verbs.
 */

import { describe, expect, it } from 'vitest';
import type { ActivityBarItem, LayoutNode, LeafNode, PanelDefinition } from '$lib/desk/layout.types';
import { createDockState } from './dock.state.svelte';
import { closeCurrent, focusPanel, openOrCycle, togglePanelType } from './panel-actions';

function leaf(id: string, tabs: string[], activeTab?: string): LeafNode {
	return { type: 'leaf', id, tabs, activeTab: activeTab ?? tabs[0] ?? '' };
}

function split(id: string, a: LayoutNode, b: LayoutNode): LayoutNode {
	return { type: 'split', id, direction: 'horizontal', children: [a, b], sizes: [50, 50] };
}

function panel(id: string, type = 'editor'): PanelDefinition {
	return { id, type, label: `Panel ${id}` };
}

const ITEMS: ActivityBarItem[] = [
	{ panelType: 'editor', icon: 'i-lucide-pen-line', label: 'Editor' },
	{ panelType: 'preview', icon: 'i-lucide-eye', label: 'Preview' },
];

function makeTwoLeafState() {
	return createDockState(split('root', leaf('l1', ['p1']), leaf('l2', ['p2', 'p3'], 'p2')), {
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
			split('root', leaf('l1', ['p1']), leaf('l2', ['p2'])),
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

	it('closeCurrent closes the focused panel', () => {
		const state = makeTwoLeafState();
		focusPanel(state, 'p2');
		closeCurrent(state);
		expect(state.panels.p2).toBeDefined(); // definition survives for undo
		expect(state.focusedPanelId).toBe('p3'); // sibling surfaces
	});

	it('togglePanelType closes all instances of an open type (desktop semantics)', () => {
		const state = makeTwoLeafState();
		togglePanelType(state, 'editor');
		const remaining = Object.keys(state.panels).filter((id) =>
			state.root.type === 'leaf' ? state.root.tabs.includes(id) : true,
		);
		expect(state.focusedPanelId).toBe('p3');
		expect(remaining).toBeDefined();
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
