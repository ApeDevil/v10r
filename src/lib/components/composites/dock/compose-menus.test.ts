import { describe, expect, it, vi } from 'vitest';
import { collectTypeInstances, composePanelMenus } from './compose-menus';
import type { PanelDefinition } from './dock.types';
import { buildViewMenu } from './view-menu';

const noopActions = {
	togglePanelType: () => {},
	splitFocused: () => {},
	closeFocusedPanel: () => {},
	openPreferences: () => {},
};

function panel(id: string, overrides?: Partial<PanelDefinition>): PanelDefinition {
	return { id, type: 'editor', label: `Panel ${id}`, ...overrides };
}

describe('buildViewMenu', () => {
	it('structural surface includes the split commands', () => {
		const menu = buildViewMenu({ structural: true, actions: noopActions });
		const labels = menu.items.map((i) => i.label).filter(Boolean);
		expect(labels).toContain('Split Right');
		expect(labels).toContain('Split Down');
	});

	it('non-structural surface strips the split commands (mobile invariant)', () => {
		const menu = buildViewMenu({ structural: false, actions: noopActions });
		const labels = menu.items.map((i) => i.label).filter(Boolean);
		expect(labels).not.toContain('Split Right');
		expect(labels).not.toContain('Split Down');
		expect(labels).toContain('Close Active Panel');
	});
});

describe('composePanelMenus', () => {
	const viewMenu = buildViewMenu({ structural: false, actions: noopActions });

	it('is never empty for a real panel — the floor menu guarantees a Close row', () => {
		const menus = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [{ id: 'p1', label: 'Panel p1' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn() },
		});
		const floor = menus.find((m) => m.label === 'Panel');
		expect(floor).toBeDefined();
		expect(floor?.items.map((i) => i.label)).toContain('Close Panel');
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
			actions: { focusPanel, closePanel: vi.fn() },
		});
		const floor = menus.find((m) => m.label === 'Panel');
		const switchRow = floor?.items.find((i) => i.label === 'Switch to Two');
		expect(switchRow).toBeDefined();
		switchRow?.onSelect?.();
		expect(focusPanel).toHaveBeenCalledWith('p2');
	});

	it('omits Close for closable:false panels and drops empty registered menus', () => {
		const menus = composePanelMenus({
			registered: [{ label: 'Empty', items: [{ type: 'separator' }] }],
			panel: panel('p1', { closable: false }),
			instances: [{ id: 'p1', label: 'One' }],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel: vi.fn() },
		});
		expect(menus.find((m) => m.label === 'Empty')).toBeUndefined();
		expect(menus.find((m) => m.label === 'Panel')).toBeUndefined();
		expect(menus.find((m) => m.label === 'View')).toBeDefined();
	});

	it('marks Close Other Instances destructive and closes every sibling', () => {
		const closePanel = vi.fn();
		const menus = composePanelMenus({
			registered: [],
			panel: panel('p1'),
			instances: [
				{ id: 'p1', label: 'One' },
				{ id: 'p2', label: 'Two' },
				{ id: 'p3', label: 'Three' },
			],
			viewMenu,
			actions: { focusPanel: vi.fn(), closePanel },
		});
		const row = menus.find((m) => m.label === 'Panel')?.items.find((i) => i.label === 'Close Other Instances');
		expect(row?.destructive).toBe(true);
		row?.onSelect?.();
		expect(closePanel).toHaveBeenCalledTimes(2);
		expect(closePanel).toHaveBeenCalledWith('p2');
		expect(closePanel).toHaveBeenCalledWith('p3');
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
