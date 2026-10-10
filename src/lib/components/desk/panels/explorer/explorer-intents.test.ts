import { describe, expect, it } from 'vitest';
import {
	applyIntent,
	confirmIntent,
	type ExplorerIntent,
	type ExplorerNodeMap,
	foldIntents,
	isNoOpIntent,
	rejectIntent,
} from './explorer-intents';
import type { ExplorerNode } from './node';

function folder(id: string, parentId: string | null): ExplorerNode {
	return {
		id,
		parentId,
		source: 'desk-folder',
		sourceData: {},
		label: id,
		icon: 'i-lucide-folder',
		isFolder: true,
		capabilities: new Set(['move']),
		sortKey: `0_${id}`,
	};
}

function tree(...nodes: ExplorerNode[]): ExplorerNodeMap {
	return new Map(nodes.map((n) => [n.id, n]));
}

const move = (seq: number, nodeId: string, parentId: string | null): ExplorerIntent => ({
	seq,
	kind: 'move',
	nodeId,
	parentId,
});

const parentOf = (nodes: ExplorerNodeMap, id: string) => nodes.get(id)?.parentId;

// n starts in P; X and Y are the two places the user moves it to.
const base = tree(folder('P', null), folder('X', null), folder('Y', null), folder('n', 'P'));

describe('foldIntents', () => {
	it('shows pending moves in issue order on top of the confirmed tree', () => {
		const shown = foldIntents(base, [move(0, 'n', 'X'), move(1, 'n', 'Y')]);
		expect(parentOf(shown, 'n')).toBe('Y');
		// The confirmed half is never written by a read.
		expect(parentOf(base, 'n')).toBe('P');
	});

	it('returns the confirmed map itself when nothing is pending', () => {
		expect(foldIntents(base, [])).toBe(base);
	});

	it('skips a move that would make a node its own ancestor', () => {
		// H was moved out of F, then F moved under H; the first move failing leaves a
		// subset fold that would put H in F and F in H.
		const confirmed = tree(folder('F', null), folder('H', 'F'));
		const shown = foldIntents(confirmed, [move(1, 'F', 'H')]);
		expect(parentOf(shown, 'F')).toBeNull();
		expect(parentOf(shown, 'H')).toBe('F');
	});

	it('ignores an intent for a node a refresh removed', () => {
		expect(applyIntent(base, { kind: 'move', nodeId: 'gone', parentId: 'X' })).toBe(base);
	});

	it('folds an AI-context pin without touching the confirmed node', () => {
		const pinned = foldIntents(base, [{ seq: 0, kind: 'ai-context', nodeId: 'n', aiContext: true }]);
		expect(pinned.get('n')?.aiContext).toBe(true);
		expect(base.get('n')?.aiContext).toBeUndefined();
	});
});

describe('settling intents', () => {
	it('success: the move becomes confirmed and leaves the pending list', () => {
		const settled = confirmIntent(base, [move(0, 'n', 'X')], 0);
		expect(settled.superseded).toBe(false);
		expect(parentOf(settled.confirmed, 'n')).toBe('X');
		expect(settled.pending).toEqual([]);
	});

	it('single failure: dropping the intent restores the confirmed parent', () => {
		const pending = rejectIntent([move(0, 'n', 'X')], 0);
		expect(parentOf(foldIntents(base, pending), 'n')).toBe('P');
	});

	it('A in flight, B succeeds, A fails: the node stays at B', () => {
		let confirmed = base;
		let pending = [move(0, 'n', 'X'), move(1, 'n', 'Y')];

		const b = confirmIntent(confirmed, pending, 1);
		confirmed = b.confirmed;
		pending = b.pending;
		expect(parentOf(foldIntents(confirmed, pending), 'n')).toBe('Y');

		pending = rejectIntent(pending, 0);
		expect(parentOf(foldIntents(confirmed, pending), 'n')).toBe('Y');
		expect(parentOf(confirmed, 'n')).toBe('Y');
	});

	it('B succeeds while A is in flight: the tree does not flicker back to A', () => {
		const b = confirmIntent(base, [move(0, 'n', 'X'), move(1, 'n', 'Y')], 1);
		expect(b.pending).toEqual([]);
		expect(parentOf(foldIntents(b.confirmed, b.pending), 'n')).toBe('Y');
	});

	it('A succeeds after B already confirmed: reported superseded, nothing applied', () => {
		const b = confirmIntent(base, [move(0, 'n', 'X'), move(1, 'n', 'Y')], 1);
		const a = confirmIntent(b.confirmed, b.pending, 0);
		expect(a.superseded).toBe(true);
		expect(parentOf(a.confirmed, 'n')).toBe('Y');
	});

	it('A fails while B is still in flight: B stays shown', () => {
		const pending = rejectIntent([move(0, 'n', 'X'), move(1, 'n', 'Y')], 0);
		expect(parentOf(foldIntents(base, pending), 'n')).toBe('Y');
	});

	it('confirming one node leaves pending moves of other nodes alone', () => {
		const withSibling = tree(...base.values(), folder('m', 'P'));
		const settled = confirmIntent(withSibling, [move(0, 'm', 'X'), move(1, 'n', 'Y')], 0);
		expect(settled.pending).toEqual([move(1, 'n', 'Y')]);
	});

	it('matches intents by seq, not by reference', () => {
		// A structurally equal copy — what a proxy would hand back — still settles.
		const pending = [move(0, 'n', 'X')];
		expect(
			rejectIntent(
				pending.map((p) => ({ ...p })),
				0,
			),
		).toEqual([]);
	});
});

describe('isNoOpIntent (duplicate-submit guard)', () => {
	it('is a no-op when the shown tree already has the node at the target', () => {
		const shown = foldIntents(base, [move(0, 'n', 'X')]);
		expect(isNoOpIntent(shown, { kind: 'move', nodeId: 'n', parentId: 'X' })).toBe(true);
	});

	it('is not a no-op to move back to where the confirmed tree has it', () => {
		const shown = foldIntents(base, [move(0, 'n', 'X')]);
		expect(isNoOpIntent(shown, { kind: 'move', nodeId: 'n', parentId: 'P' })).toBe(false);
	});

	it('is a no-op for a node that no longer exists', () => {
		expect(isNoOpIntent(base, { kind: 'move', nodeId: 'gone', parentId: 'X' })).toBe(true);
	});
});
