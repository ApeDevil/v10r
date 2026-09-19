import { describe, expect, it, vi } from 'vitest';
import type { ActivityBarItem, PanelDefinition } from '$lib/desk/layout.types';
import { collectTypeInstances, composePanelMenus, shortcutTableMarkdown } from './compose-menus';
import { buildViewMenu } from './view-menu';

const BAR_ITEMS: ActivityBarItem[] = [
	{ panelType: 'explorer', icon: 'i-lucide-folder-tree', label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
	{ panelType: 'editor', icon: 'i-lucide-pen-line', label: 'Editor' },
	{ panelType: 'preview', icon: 'i-lucide-eye', label: 'Preview', shortcut: 'Ctrl+Shift+P' },
];

const noopActions = {
	items: BAR_ITEMS,
	togglePanelType: () => {},
	splitFocused: () => {},
	openPreferences: () => {},
};

function panel(id: string, overrides?: Partial<PanelDefinition>): PanelDefinition {
	return { id, type: 'editor', label: `Panel ${id}`, ...overrides };
}

describe('buildViewMenu', () => {
	it('carries the dock-level commands: toggles, splits, preferences', () => {
		const menu = buildViewMenu(noopActions);
		const labels = menu.items.map((i) => i.label).filter(Boolean);
		expect(labels).toEqual(['Toggle Explorer', 'Toggle Preview', 'Split Right', 'Split Down', 'Desk Preferences…']);
	});

	it('derives a toggle row from every bar item that declares a chord — the item is the one declaration', () => {
		const togglePanelType = vi.fn();
		const menu = buildViewMenu({ ...noopActions, togglePanelType });
		const preview = menu.items.find((i) => i.label === 'Toggle Preview');
		expect(preview?.shortcut).toBe('Ctrl+Shift+P');
		expect(preview?.icon).toBe('i-lucide-eye');
		preview?.onSelect?.();
		expect(togglePanelType).toHaveBeenCalledWith('preview');
		// No chord, no row: Editor is opened from a file, never toggled from View.
		expect(menu.items.some((i) => i.label === 'Toggle Editor')).toBe(false);
		// A host without chords (the dock showcase) gets splits + preferences only, with no leading rule.
		const bare = buildViewMenu({ ...noopActions, items: [] });
		expect(bare.items[0]?.type).toBe('separator');
		expect(
			composePanelMenus({
				registered: [],
				panel: null,
				instances: [],
				viewMenu: bare,
				actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
			})[0]?.items[0]?.label,
		).toBe('Split Right');
	});

	it('does not close panels — that decision has one row, on the Panel floor', () => {
		const menu = buildViewMenu(noopActions);
		expect(menu.items.some((i) => i.shortcut === 'Ctrl+W')).toBe(false);
	});
});

describe('composePanelMenus', () => {
	const viewMenu = buildViewMenu(noopActions);

	it('appends View only when the projection passes one — the mobile sheet passes none', () => {
		const input = {
			registered: [{ label: 'File', items: [{ label: 'Save', onSelect: () => {} }] }],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'One' }],
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
		};
		expect(composePanelMenus({ ...input, viewMenu }).map((m) => m.label)).toEqual(['File', 'Panel', 'View']);
		expect(composePanelMenus({ ...input, viewMenu: null }).map((m) => m.label)).toEqual(['File', 'Panel']);
	});

	it('is never empty for a real panel — the floor menu guarantees a Close row', () => {
		const menus = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'Panel p1' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
		});
		const floor = menus.find((m) => m.label === 'Panel');
		expect(floor).toBeDefined();
		const close = floor?.items.find((i) => i.label === 'Close Panel');
		expect(close?.shortcut).toBe('Ctrl+W');
	});

	it('puts About <title> last on the floor when help is given, and nowhere otherwise', () => {
		const open = vi.fn();
		const withHelp = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
			help: { title: 'Editor', open },
		});
		const floor = withHelp.find((m) => m.label === 'Panel');
		const last = floor?.items.at(-1);
		expect(last?.label).toBe('About Editor');
		expect(floor?.items.at(-2)?.type).toBe('separator');
		last?.onSelect?.();
		expect(open).toHaveBeenCalledTimes(1);
		expect(withHelp.find((m) => m.label === 'Help')).toBeUndefined();

		const withoutHelp = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
		});
		expect(withoutHelp.flatMap((m) => m.items).some((i) => i.label?.startsWith('About'))).toBe(false);
	});

	it('help alone still yields a floor menu (closable:false, no siblings) with no leading separator', () => {
		const menus = composePanelMenus({
			registered: [],
			panel: panel('p1', { closable: false }),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
			help: { title: 'Preview', open: vi.fn() },
		});
		const floor = menus.find((m) => m.label === 'Panel');
		expect(floor?.items.map((i) => i.label ?? i.type)).toEqual(['About Preview']);
	});

	it('lists switch-to rows only when siblings exist, and wires them to focusPanel', () => {
		const focusPanel = vi.fn();
		const menus = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [
				{ id: 'p1', label: 'One' },
				{ id: 'p2', label: 'Two' },
			],
			viewMenu,
			actions: { focusPanel, closePanel: vi.fn(), closePanels: vi.fn() },
		});
		const floor = menus.find((m) => m.label === 'Panel');
		const switchRow = floor?.items.find((i) => i.label === 'Switch to Two');
		expect(switchRow).toBeDefined();
		switchRow?.onSelect?.();
		expect(focusPanel).toHaveBeenCalledWith('p2');
	});

	it('normalises separators once for every projection: none leading, trailing or doubled', () => {
		const menus = composePanelMenus({
			registered: [
				// The editor's File menu on a saved post: Save is gone, its separator stayed.
				{
					label: 'File',
					items: [{ type: 'separator' }, { label: 'Export', onSelect: () => {} }, { type: 'separator' }],
				},
				{
					label: 'Post',
					items: [
						{ label: 'A', onSelect: () => {} },
						{ type: 'separator' },
						{ type: 'separator' },
						{ label: 'B', onSelect: () => {} },
					],
				},
			],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
		});
		expect(menus.find((m) => m.label === 'File')?.items.map((i) => i.label ?? i.type)).toEqual(['Export']);
		expect(menus.find((m) => m.label === 'Post')?.items.map((i) => i.label ?? i.type)).toEqual(['A', 'separator', 'B']);
	});

	it('omits Close for closable:false panels and drops empty registered menus', () => {
		const menus = composePanelMenus({
			registered: [{ label: 'Empty', items: [{ type: 'separator' }] }],
			panel: panel('p1', { closable: false }),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
		});
		expect(menus.find((m) => m.label === 'Empty')).toBeUndefined();
		expect(menus.find((m) => m.label === 'Panel')).toBeUndefined();
		expect(menus.find((m) => m.label === 'View')).toBeDefined();
	});

	it('marks Close Other Instances destructive and closes every sibling in one batch', () => {
		const closePanels = vi.fn();
		const menus = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [
				{ id: 'p1', label: 'One' },
				{ id: 'p2', label: 'Two' },
				{ id: 'p3', label: 'Three' },
			],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels },
		});
		const row = menus.find((m) => m.label === 'Panel')?.items.find((i) => i.label === 'Close Other Instances');
		expect(row?.destructive).toBe(true);
		row?.onSelect?.();
		// One call with the batch: the dock's unsaved-close guard prompts once, not per sibling.
		expect(closePanels).toHaveBeenCalledTimes(1);
		expect(closePanels).toHaveBeenCalledWith(['p2', 'p3']);
	});
});

describe('shortcutTableMarkdown', () => {
	it('lists every declared chord as "Menu › Item", and nothing when none is declared', () => {
		const menus = composePanelMenus({
			registered: [{ label: 'File', items: [{ label: 'Save', shortcut: 'Ctrl+S', onSelect: () => {} }] }],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu: buildViewMenu(noopActions),
			actions: { focusPanel: vi.fn(), closePanel: vi.fn(), closePanels: vi.fn() },
		});
		const table = shortcutTableMarkdown(menus);
		expect(table.split('\n')).toEqual([
			'| Shortcut | Action |',
			'|---|---|',
			'| Ctrl+S | File › Save |',
			'| Ctrl+W | Panel › Close Panel |',
			'| Ctrl+Shift+E | View › Toggle Explorer |',
			'| Ctrl+Shift+P | View › Toggle Preview |',
			'| Ctrl+Shift+, | View › Desk Preferences… |',
		]);
		expect(shortcutTableMarkdown([{ label: 'Log', items: [{ label: 'Clear', onSelect: () => {} }] }])).toBe('');
	});
});

describe('collectTypeInstances', () => {
	it('returns tree-ordered instances of the type with labels', () => {
		const panels = {
			a: panel('a'),
			b: panel('b', { type: 'preview' }),
			c: panel('c'),
		};
		expect(collectTypeInstances(['a', 'b', 'c'], panels, 'editor')).toEqual([
			{ id: 'a', label: 'Panel a' },
			{ id: 'c', label: 'Panel c' },
		]);
		expect(collectTypeInstances(['a'], panels, undefined)).toEqual([]);
	});
});
