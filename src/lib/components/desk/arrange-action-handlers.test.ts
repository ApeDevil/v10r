/**
 * The Desk's client action handlers, run against a REAL dock state — no mocked panels.
 * Each test asserts two things that must agree: what the handler reported, and what the
 * dock actually holds afterwards. A handler that says `completed` over a dock that did not
 * change is the bug this file exists to catch.
 */
import { describe, expect, it, vi } from 'vitest';
import { createClientActionRunner } from '#lib/client-actions/runner.ts';
import { DESK_ARRANGE_ACTIONS } from '#lib/desk/arrange-actions.ts';
import type { LayoutNode, LeafNode, PanelDefinition } from '#lib/desk/layout.types.ts';
import { type ArrangeFile, mountArrangeHandlers } from './arrange-action-handlers';
import { collectLeaves, findLeafWithPanel, getDepth } from './dock.operations';
import { createDockState, MAX_DOCK_DEPTH } from './dock.state.svelte';

const FILES: Record<string, ArrangeFile> = {
	fil_arch: { id: 'fil_arch', name: 'Architecture', type: 'markdown' },
	fil_budget: { id: 'fil_budget', name: 'Budget', type: 'spreadsheet' },
	fil_odd: { id: 'fil_odd', name: 'Odd', type: 'folder' },
};

const leaf = (id: string, tabs: string[], activeTab = tabs[0] ?? ''): LeafNode => ({
	type: 'leaf',
	id,
	tabs,
	activeTab,
});
const hsplit = (id: string, a: LayoutNode, b: LayoutNode): LayoutNode => ({
	type: 'split',
	id,
	direction: 'horizontal',
	children: [a, b],
	sizes: [50, 50],
});
const panel = (id: string, type: string, extra: Partial<PanelDefinition> = {}): PanelDefinition => ({
	id,
	type,
	label: id,
	closable: true,
	...extra,
});

function desk(root: LayoutNode, panels: PanelDefinition[]) {
	const dock = createDockState(root, Object.fromEntries(panels.map((p) => [p.id, p])));
	const runner = createClientActionRunner(DESK_ARRANGE_ACTIONS);
	const loadFile = vi.fn(async (fileId: string) => FILES[fileId] ?? null);
	const unmount = mountArrangeHandlers(runner, { dock, conversationPanelId: 'bot', loadFile });
	let calls = 0;
	const run = (name: string, input: unknown) => runner.run({ callId: `call_${calls++}`, name, input });
	return { dock, runner, loadFile, unmount, run };
}

const botOnly = () => desk(leaf('l-bot', ['bot']), [panel('bot', 'bot')]);
const botAndExplorer = () =>
	desk(hsplit('s', leaf('l-left', ['explorer']), leaf('l-bot', ['bot'])), [
		panel('explorer', 'explorer'),
		panel('bot', 'bot'),
	]);

describe('mountArrangeHandlers', () => {
	it('advertises all three actions while mounted and none after', () => {
		const { runner, unmount } = botOnly();
		expect(runner.available()).toEqual(['desk_open_file', 'desk_focus_panel', 'desk_close_panel']);
		unmount();
		expect(runner.available()).toEqual([]);
	});
});

describe('desk_open_file', () => {
	it('opens the file beside the conversation and reports the panel it sees in front', async () => {
		const { dock, run } = botAndExplorer();
		const result = await run('desk_open_file', { file_id: 'fil_arch' });
		expect(result).toEqual({
			status: 'completed',
			observed: {
				panel_id: 'markdown-fil_arch',
				file_id: 'fil_arch',
				panel_type: 'markdown',
				placed: 'tab',
				front: true,
			},
		});
		expect(findLeafWithPanel(dock.root, 'markdown-fil_arch')?.id).toBe('l-left');
		expect(dock.focusedPanelId).toBe('markdown-fil_arch');
		expect(dock.panels['markdown-fil_arch']).toMatchObject({ label: 'Architecture', meta: { fileId: 'fil_arch' } });
		// The conversation is still the front tab of its own leaf.
		expect(findLeafWithPanel(dock.root, 'bot')?.activeTab).toBe('bot');
	});

	it('never covers the conversation: a lone leaf is split, the file goes to the right', async () => {
		const { dock, run } = botOnly();
		const result = await run('desk_open_file', { file_id: 'fil_arch' });
		expect(result).toMatchObject({ status: 'completed', observed: { placed: 'split' } });
		const leaves = collectLeaves(dock.root);
		expect(leaves.map((l) => l.tabs)).toEqual([['bot'], ['markdown-fil_arch']]);
	});

	it('placement "right" uses the right-hand pane, and creates one when the workspace has none', async () => {
		const wide = desk(hsplit('s', leaf('l-bot', ['bot']), leaf('l-right', ['explorer'])), [
			panel('bot', 'bot'),
			panel('explorer', 'explorer'),
		]);
		expect(await wide.run('desk_open_file', { file_id: 'fil_budget', placement: 'right' })).toMatchObject({
			status: 'completed',
			observed: { placed: 'tab', panel_type: 'spreadsheet' },
		});
		expect(findLeafWithPanel(wide.dock.root, 'spreadsheet-fil_budget')?.id).toBe('l-right');

		const lone = botOnly();
		expect(await lone.run('desk_open_file', { file_id: 'fil_budget', placement: 'right' })).toMatchObject({
			status: 'completed',
			observed: { placed: 'split' },
		});
		expect(collectLeaves(lone.dock.root).at(-1)?.tabs).toEqual(['spreadsheet-fil_budget']);
	});

	it('brings an already open file forward instead of opening it twice', async () => {
		const { dock, run } = botAndExplorer();
		await run('desk_open_file', { file_id: 'fil_arch' });
		await run('desk_focus_panel', { panel_id: 'bot' });
		const again = await run('desk_open_file', { file_id: 'fil_arch', placement: 'right' });
		expect(again).toMatchObject({ status: 'completed', observed: { placed: 'existing', front: true } });
		const open = collectLeaves(dock.root).flatMap((l) => l.tabs);
		expect(open.filter((id) => id.includes('fil_arch'))).toEqual(['markdown-fil_arch']);
	});

	it('fails without touching the dock when the user has no such file', async () => {
		const { dock, run } = botAndExplorer();
		const before = dock.root;
		const result = await run('desk_open_file', { file_id: 'fil_someoneelse' });
		expect(result).toMatchObject({ status: 'failed', code: 'not_found' });
		expect(dock.root).toBe(before);
	});

	it('refuses an id that is not a desk file id before any lookup', async () => {
		const { run, loadFile } = botAndExplorer();
		const result = await run('desk_open_file', { file_id: '../../admin' });
		expect(result).toMatchObject({ status: 'refused', code: 'invalid_input' });
		expect(loadFile).not.toHaveBeenCalled();
	});

	it('refuses a file type that has no panel', async () => {
		const { run } = botAndExplorer();
		expect(await run('desk_open_file', { file_id: 'fil_odd' })).toMatchObject({
			status: 'refused',
			code: 'no_panel_for_type',
		});
	});

	it('reports a lookup that throws as failed, never as opened', async () => {
		const { dock, run, loadFile } = botAndExplorer();
		loadFile.mockRejectedValueOnce(new Error('File lookup failed (500).'));
		const result = await run('desk_open_file', { file_id: 'fil_arch' });
		expect(result).toMatchObject({ status: 'failed', code: 'handler_error' });
		expect(findLeafWithPanel(dock.root, 'markdown-fil_arch')).toBeNull();
	});

	it('joins a leaf as a tab once the split tree is as deep as the dock allows', async () => {
		let root: LayoutNode = leaf('l-bot', ['bot']);
		const panels = [panel('bot', 'bot')];
		for (let i = 0; i < MAX_DOCK_DEPTH; i++) {
			root = {
				type: 'split',
				id: `s${i}`,
				direction: 'vertical',
				children: [root, leaf(`l${i}`, [`p${i}`])],
				sizes: [50, 50],
			};
			panels.push(panel(`p${i}`, 'preview'));
		}
		const { dock, run } = desk(root, panels);
		expect(await run('desk_open_file', { file_id: 'fil_arch', placement: 'right' })).toMatchObject({
			status: 'completed',
			observed: { placed: 'tab' },
		});
		expect(getDepth(dock.root)).toBe(MAX_DOCK_DEPTH);
	});
});

describe('desk_focus_panel', () => {
	it('brings the panel to the front and says so only when it is', async () => {
		const { dock, run } = desk(hsplit('s', leaf('l-left', ['a', 'b'], 'a'), leaf('l-bot', ['bot'])), [
			panel('a', 'markdown'),
			panel('b', 'markdown'),
			panel('bot', 'bot'),
		]);
		expect(await run('desk_focus_panel', { panel_id: 'b' })).toEqual({
			status: 'completed',
			observed: { panel_id: 'b', front: true },
		});
		expect(findLeafWithPanel(dock.root, 'b')?.activeTab).toBe('b');
		expect(dock.focusedPanelId).toBe('b');
	});

	it('is unavailable for a panel that is no longer open — the model was looking at a stale desk', async () => {
		const { dock, run } = botAndExplorer();
		dock.closePanel('explorer');
		const result = await run('desk_focus_panel', { panel_id: 'explorer' });
		expect(result).toMatchObject({ status: 'unavailable', code: 'target_missing' });
		expect(dock.focusedPanelId).toBe('bot');
	});
});

describe('desk_close_panel', () => {
	it('closes the panel and reports it closed', async () => {
		const { dock, run } = botAndExplorer();
		expect(await run('desk_close_panel', { panel_id: 'explorer' })).toEqual({
			status: 'completed',
			observed: { panel_id: 'explorer', open: false },
		});
		expect(findLeafWithPanel(dock.root, 'explorer')).toBeNull();
	});

	it('is idempotent: closing a closed panel completes without touching anything', async () => {
		const { dock, run } = botAndExplorer();
		dock.closePanel('explorer');
		const before = dock.root;
		expect(await run('desk_close_panel', { panel_id: 'explorer' })).toMatchObject({
			status: 'completed',
			observed: { already_closed: true },
		});
		expect(dock.root).toBe(before);
	});

	it.each(['unsaved', 'saving'] as const)('refuses a panel whose work is %s, and leaves it open', async (indicator) => {
		const { dock, run } = desk(hsplit('s', leaf('l-left', ['doc']), leaf('l-bot', ['bot'])), [
			panel('doc', 'markdown', { indicator }),
			panel('bot', 'bot'),
		]);
		expect(await run('desk_close_panel', { panel_id: 'doc' })).toMatchObject({
			status: 'refused',
			code: 'unsaved_work',
		});
		expect(findLeafWithPanel(dock.root, 'doc')).not.toBeNull();
		// The agent's refusal is not the user's confirm dialog: nothing is left pending.
		expect(dock.pendingClose).toBeNull();
	});

	it('refuses the conversation panel and a panel that is not closable', async () => {
		const { dock, run } = desk(hsplit('s', leaf('l-left', ['pinned']), leaf('l-bot', ['bot'])), [
			panel('pinned', 'explorer', { closable: false }),
			panel('bot', 'bot'),
		]);
		expect(await run('desk_close_panel', { panel_id: 'bot' })).toMatchObject({ status: 'refused', code: 'own_panel' });
		expect(await run('desk_close_panel', { panel_id: 'pinned' })).toMatchObject({
			status: 'refused',
			code: 'not_closable',
		});
		expect(collectLeaves(dock.root).flatMap((l) => l.tabs)).toEqual(['pinned', 'bot']);
	});

	it('is unavailable for a panel id the desk has never had', async () => {
		const { run } = botAndExplorer();
		expect(await run('desk_close_panel', { panel_id: 'nope' })).toMatchObject({
			status: 'unavailable',
			code: 'target_missing',
		});
	});
});
