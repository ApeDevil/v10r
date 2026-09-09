import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * localStorage round-trips for the desk.
 *
 * Everything here parses content the app does not control: a visitor's stored blob can be
 * truncated by a quota error, left behind by an older schema, or hand-edited. All three
 * loaders run on the desk's boot path, so a throw is a blank workspace rather than a
 * degraded one — and `loadDockState` additionally has to prune tab references to panels
 * that no longer exist, which is how a renamed panel type would otherwise render an empty
 * tab strip.
 *
 * The global `$app/environment` mock reports `browser: false` (correct for the server
 * suite), and every function below early-returns on that — so this file overrides it and
 * supplies a localStorage stub. That override is the reason this cannot simply live in
 * one of the other desk test files.
 */
vi.mock('$app/environment', () => ({ browser: true, building: false, dev: true, version: 'test' }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
	removeItem: (k: string) => void store.delete(k),
	clear: () => store.clear(),
});

const { saveDockState, loadDockState } = await import('./dock.persistence');
const { saveDeskSettings, loadDeskSettings, DEFAULT_THEME } = await import('./desk-settings.persistence');
const workspace = await import('./workspace.persistence');

const KEY = 'test-key';
const leaf = (id: string, tabs: string[], activeTab = tabs[0]) => ({ type: 'leaf' as const, id, tabs, activeTab });
const panels = { p1: { id: 'p1', type: 'editor', label: 'P1' }, p2: { id: 'p2', type: 'editor', label: 'P2' } };

beforeEach(() => store.clear());

describe('dock layout persistence', () => {
	it('round-trips a saved layout', () => {
		saveDockState(leaf('l1', ['p1', 'p2']), panels, KEY, 'left', 'l1');
		const loaded = loadDockState(KEY);
		expect(loaded?.root).toMatchObject({ id: 'l1', tabs: ['p1', 'p2'] });
		expect(loaded?.activityBarPosition).toBe('left');
		expect(loaded?.focusedLeafId).toBe('l1');
	});

	it('returns null rather than throwing on content it cannot parse', () => {
		for (const raw of ['', '{', 'not json', 'null', '[]', '"a string"', '{"version":1}']) {
			store.set(KEY, raw);
			expect(loadDockState(KEY), raw).toBeNull();
		}
	});

	it('returns null for a stored version it does not understand', () => {
		store.set(KEY, JSON.stringify({ version: 99, root: leaf('l1', ['p1']), panels }));
		expect(loadDockState(KEY)).toBeNull();
	});

	it('returns null for a structurally invalid tree instead of half-loading it', () => {
		const bad = [
			{ type: 'leaf', id: 'l1' }, // no tabs
			{ type: 'split', id: 's1', direction: 'sideways', children: [], sizes: [] },
			{ type: 'split', id: 's1', direction: 'horizontal', children: [leaf('a', ['p1'])], sizes: [50, 50] },
			{ type: 'unknown', id: 'x' },
		];
		for (const root of bad) {
			store.set(KEY, JSON.stringify({ version: 1, root, panels }));
			expect(loadDockState(KEY), JSON.stringify(root)).toBeNull();
		}
	});

	it('prunes tabs referencing panels that no longer exist', () => {
		store.set(KEY, JSON.stringify({ version: 1, root: leaf('l1', ['p1', 'gone', 'p2']), panels }));
		expect((loadDockState(KEY)?.root as { tabs: string[] }).tabs).toEqual(['p1', 'p2']);
	});

	// `in` walks the prototype chain, so a stored tab named `toString` or `constructor` used
	// to pass the prune and reach the renderer — where `panels['toString']` resolves to a
	// function that gets treated as a PanelDefinition.
	it('prunes tabs named after Object.prototype members', () => {
		const tabs = ['p1', 'toString', 'constructor', '__proto__', 'hasOwnProperty'];
		store.set(KEY, JSON.stringify({ version: 1, root: leaf('l1', tabs, 'p1'), panels }));
		expect((loadDockState(KEY)?.root as { tabs: string[] }).tabs).toEqual(['p1']);
	});

	it('re-points activeTab when the stored active tab was pruned away', () => {
		store.set(KEY, JSON.stringify({ version: 1, root: leaf('l1', ['gone', 'p1'], 'gone'), panels }));
		const root = loadDockState(KEY)?.root as { tabs: string[]; activeTab: string };
		expect(root.tabs).toEqual(['p1']);
		expect(root.activeTab).toBe('p1');
	});

	it('prunes inside a nested split, not just at the root', () => {
		const root = {
			type: 'split',
			id: 's1',
			direction: 'horizontal',
			sizes: [50, 50],
			children: [leaf('a', ['p1', 'gone']), leaf('b', ['gone', 'p2'], 'gone')],
		};
		store.set(KEY, JSON.stringify({ version: 1, root, panels }));
		const loaded = loadDockState(KEY)?.root as { children: { tabs: string[]; activeTab: string }[] };
		expect(loaded.children[0].tabs).toEqual(['p1']);
		expect(loaded.children[1].tabs).toEqual(['p2']);
		expect(loaded.children[1].activeTab).toBe('p2');
	});
});

describe('desk settings persistence', () => {
	it('round-trips a theme', () => {
		saveDeskSettings({ ...DEFAULT_THEME, activePresetId: 'preset-default' }, KEY);
		expect(loadDeskSettings(KEY)?.activePresetId).toBe('preset-default');
	});

	it('degrades to null rather than throwing on unparseable or stale content', () => {
		for (const raw of ['', '{', 'not json', 'null', JSON.stringify({ version: 1 })]) {
			store.set(KEY, raw);
			expect(loadDeskSettings(KEY), raw).toBeNull();
		}
	});
});

describe('workspace persistence', () => {
	it('degrades to a safe value rather than throwing on unparseable content', () => {
		const loaders = Object.entries(workspace).filter(([name]) => name.startsWith('load'));
		expect(loaders.length).toBeGreaterThan(0);
		for (const [name, fn] of loaders) {
			for (const raw of ['', '{', 'not json', 'null', '[]']) {
				store.clear();
				store.set('desk-workspace', raw);
				store.set(KEY, raw);
				expect(() => (fn as (k?: string) => unknown)(KEY), `${name} on ${JSON.stringify(raw)}`).not.toThrow();
			}
		}
	});
});
