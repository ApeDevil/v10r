import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpreadsheetCells } from '$lib/desk/spreadsheet-cells';
import { createSpreadsheetState } from './spreadsheet.state.svelte';
import { createSpreadsheetAutosave } from './spreadsheet-autosave';
import { createSpreadsheetDrafts, type SpreadsheetDraft } from './spreadsheet-drafts';

const cells = (v: string) => ({ A1: { v } });
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function fixture() {
	const load = vi.fn(async () => ({ cells: cells('server'), version: 0 }));
	const save = vi.fn(async ({ version }: { version: number }) => ({ status: 'saved' as const, version: version + 1 }));
	const drafts = { write: vi.fn(), clear: vi.fn(), discard: vi.fn(), list: vi.fn(() => [] as SpreadsheetDraft[]) };
	const apply = vi.fn();
	const autosave = createSpreadsheetAutosave({ load, save, drafts, apply });
	return { autosave, load, save, drafts, apply };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('spreadsheet autosave lifecycle', () => {
	it('backs up immediately and debounces rapid edits to one latest snapshot', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.autosave.change(cells('first'));
		f.autosave.change(cells('latest'));
		expect(f.drafts.write).toHaveBeenLastCalledWith(0, cells('latest'));
		expect(f.save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1500);
		expect(f.save).toHaveBeenCalledExactlyOnceWith({ cells: cells('latest'), version: 0 });
		expect(f.autosave.snapshot.unsaved).toBe(false);
	});

	it('serializes requests and never clears edits made while a save is in flight', async () => {
		const f = fixture();
		await f.autosave.refresh();
		const first = deferred<{ status: 'saved'; version: number }>();
		f.save.mockReturnValueOnce(first.promise);
		f.autosave.change(cells('first'));
		const saving = f.autosave.flush();
		await Promise.resolve();
		f.autosave.change(cells('second'));
		await vi.advanceTimersByTimeAsync(2000);
		expect(f.save).toHaveBeenCalledTimes(1);
		expect(f.autosave.snapshot).toMatchObject({ saving: true, unsaved: true });
		first.resolve({ status: 'saved', version: 1 });
		await saving;
		expect(f.save).toHaveBeenLastCalledWith({ cells: cells('second'), version: 1 });
		expect(f.save).toHaveBeenCalledTimes(2);
		expect(f.drafts.write).toHaveBeenCalledWith(1, cells('second'));
		expect(f.autosave.snapshot.unsaved).toBe(false);
	});

	it('panel unsubscribe does not cancel the queue; closure flushes the pending debounce', async () => {
		const f = fixture();
		await f.autosave.refresh();
		const unsubscribe = f.autosave.subscribe(vi.fn());
		f.autosave.change(cells('closing'));
		unsubscribe();
		await f.autosave.flush();
		expect(f.save).toHaveBeenCalledExactlyOnceWith({ cells: cells('closing'), version: 0 });
	});

	it('retains drafts on a network failure and retries the same base version', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.save.mockRejectedValueOnce(new Error('offline'));
		f.autosave.change(cells('offline'));
		await f.autosave.flush();
		expect(f.autosave.snapshot).toMatchObject({ error: true, unsaved: true });
		expect(f.drafts.clear).not.toHaveBeenCalled();
		await f.autosave.flush();
		expect(f.save).toHaveBeenLastCalledWith({ cells: cells('offline'), version: 0 });
		expect(f.autosave.snapshot).toMatchObject({ error: false, unsaved: false });
	});

	it('leaves a failed initial load uneditable and never saves an empty replacement', async () => {
		const f = fixture();
		f.load.mockRejectedValueOnce(new Error('offline'));
		await f.autosave.refresh();
		f.autosave.change({});
		await f.autosave.flush();
		expect(f.autosave.snapshot).toMatchObject({ loaded: false, error: true });
		expect(f.save).not.toHaveBeenCalled();
		await f.autosave.refresh();
		expect(f.autosave.snapshot.loaded).toBe(true);
	});

	it('protects pending edits from AI refresh and requires explicit conflict resolution', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.autosave.change(cells('local'));
		f.load.mockResolvedValue({ cells: cells('AI'), version: 1 });
		await f.autosave.refresh();
		expect(f.apply).toHaveBeenCalledTimes(1);
		expect(f.autosave.draft.cells).toEqual(cells('local'));
		expect(f.autosave.snapshot.conflict).toBe(true);
		await f.autosave.flush();
		expect(f.save).not.toHaveBeenCalled();
		await f.autosave.discardAndReload();
		expect(f.apply).toHaveBeenLastCalledWith(cells('AI'));
		expect(f.autosave.snapshot).toMatchObject({ conflict: false, unsaved: false });
	});

	it('ignores out-of-order reads and reads that raced with a local edit', async () => {
		const f = fixture();
		await f.autosave.refresh();
		const old = deferred<{ cells: ReturnType<typeof cells>; version: number }>();
		f.load.mockReturnValueOnce(old.promise);
		const refresh = f.autosave.refresh();
		f.load.mockResolvedValueOnce({ cells: cells('newer'), version: 2 });
		await f.autosave.refresh();
		old.resolve({ cells: cells('older'), version: 1 });
		await refresh;
		expect(f.autosave.draft).toEqual({ cells: cells('newer'), version: 2 });
		const racing = deferred<{ cells: ReturnType<typeof cells>; version: number }>();
		f.load.mockReturnValueOnce(racing.promise);
		const raced = f.autosave.refresh();
		f.autosave.change(cells('typed'));
		racing.resolve({ cells: cells('remote'), version: 3 });
		await raced;
		expect(f.autosave.draft.cells).toEqual(cells('typed'));
	});

	it('does not discard local work when reload fails or the user edits during reload', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.autosave.change(cells('local'));
		f.load.mockRejectedValueOnce(new Error('offline'));
		await f.autosave.discardAndReload();
		expect(f.autosave.draft.cells).toEqual(cells('local'));
		const reload = deferred<{ cells: ReturnType<typeof cells>; version: number }>();
		f.load.mockReturnValueOnce(reload.promise);
		const discarding = f.autosave.discardAndReload();
		f.autosave.change(cells('new edit'));
		reload.resolve({ cells: cells('reloaded'), version: 0 });
		await discarding;
		expect(f.autosave.draft.cells).toEqual(cells('new edit'));
	});

	it('recovers stale drafts without rebasing or silently overwriting another tab', async () => {
		const f = fixture();
		f.load.mockResolvedValue({ cells: cells('new server'), version: 4 });
		await f.autosave.refresh();
		f.autosave.recover({ key: 'old tab', cells: cells('draft'), version: 2, updatedAt: 1 });
		await vi.advanceTimersByTimeAsync(2000);
		expect(f.autosave.snapshot).toMatchObject({ conflict: true, unsaved: true });
		expect(f.autosave.draft).toEqual({ cells: cells('draft'), version: 2 });
		expect(f.save).not.toHaveBeenCalled();
	});

	it('stops the losing tab on 409 and keeps its local draft through edits and retries', async () => {
		let serverVersion = 0;
		let serverCells: SpreadsheetCells = cells('server');
		const makeTab = () =>
			createSpreadsheetAutosave({
				load: async () => ({ cells: serverCells, version: serverVersion }),
				save: async ({ cells: next, version }) => {
					if (version !== serverVersion) return { status: 'conflict' };
					serverCells = next;
					return { status: 'saved', version: ++serverVersion };
				},
				drafts: { write: vi.fn(), clear: vi.fn(), discard: vi.fn(), list: () => [] },
				apply: vi.fn(),
			});
		const first = makeTab();
		const second = makeTab();
		await Promise.all([first.refresh(), second.refresh()]);
		first.change(cells('first'));
		second.change(cells('second'));
		await Promise.all([first.flush(), second.flush()]);
		expect(serverCells).toEqual(cells('first'));
		expect(second.snapshot).toMatchObject({ conflict: true, unsaved: true });
		second.change(cells('second, more edits'));
		await second.flush();
		expect(serverVersion).toBe(1);
		expect(second.draft.cells).toEqual(cells('second, more edits'));
	});

	it('stops offering a draft once it is recovered or dismissed', async () => {
		const f = fixture();
		const stale: SpreadsheetDraft = { key: 'other-tab', cells: cells('draft'), version: 0, updatedAt: 2 };
		const orphan: SpreadsheetDraft = { key: 'abandoned-tab', cells: cells('orphan'), version: 0, updatedAt: 1 };
		f.drafts.list.mockReturnValue([stale, orphan]);
		await f.autosave.refresh();
		expect(f.autosave.snapshot.recovery).toEqual([stale, orphan]);

		f.autosave.recover(stale);
		await f.autosave.flush();
		expect(f.drafts.discard).toHaveBeenCalledExactlyOnceWith('other-tab');
		// The banner reappears once the save settles — it must not re-offer what it just adopted.
		expect(f.autosave.snapshot).toMatchObject({ unsaved: false, recovery: [orphan] });

		f.autosave.dismiss(orphan);
		expect(f.drafts.discard).toHaveBeenLastCalledWith('abandoned-tab');
		expect(f.autosave.snapshot.recovery).toEqual([]);
	});

	it('shows backup failures without interrupting editing or server saves', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.drafts.write.mockImplementation(() => {
			throw new Error('quota');
		});
		f.autosave.change(cells('important'));
		expect(f.autosave.snapshot.backupFailed).toBe(true);
		await f.autosave.flush();
		expect(f.autosave.snapshot.unsaved).toBe(false);
	});

	it('keeps uncommitted input in the draft even when an earlier save succeeds', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.autosave.change(cells('committed'));
		f.autosave.stage(cells('still typing'));
		await f.autosave.flush();
		expect(f.save).toHaveBeenCalledExactlyOnceWith({ cells: cells('committed'), version: 0 });
		expect(f.drafts.write).toHaveBeenLastCalledWith(1, cells('still typing'));
		expect(f.autosave.snapshot.unsaved).toBe(true);
		f.autosave.stage(null);
		expect(f.autosave.snapshot.unsaved).toBe(false);
	});
});

describe('spreadsheet drafts and editing integration', () => {
	it('keeps separate user/file/tab slots across reloads and tolerates malformed records', () => {
		const map = new Map<string, string>();
		const storage: Storage = {
			get length() {
				return map.size;
			},
			key: (i) => [...map.keys()][i] ?? null,
			getItem: (key) => map.get(key) ?? null,
			setItem: (key, value) => {
				map.set(key, value);
			},
			removeItem: (key) => {
				map.delete(key);
			},
			clear: () => map.clear(),
		};
		const first = createSpreadsheetDrafts(() => storage, 'user', 'file', 'tab1');
		const second = createSpreadsheetDrafts(() => storage, 'user', 'file', 'tab2');
		first.write(0, cells('first'));
		second.write(0, cells('second'));
		second.clear();
		expect(second.list()).toMatchObject([{ cells: cells('first'), version: 0 }]);
		expect(createSpreadsheetDrafts(() => storage, 'other-user', 'file', 'tab3').list()).toEqual([]);
		expect(createSpreadsheetDrafts(() => storage, 'user', 'other-file', 'tab3').list()).toEqual([]);
		storage.setItem('v10r:spreadsheet-draft:user:file:broken', 'not json');
		expect(createSpreadsheetDrafts(() => storage, 'user', 'file', 'reloaded').list()).toHaveLength(1);

		// Dismissal is scoped: it clears a sibling slot, never the live one or another file's.
		const reloaded = createSpreadsheetDrafts(() => storage, 'user', 'file', 'tab1');
		reloaded.write(0, cells('live'));
		reloaded.discard('v10r:spreadsheet-draft:user:file:tab1');
		reloaded.discard('v10r:spreadsheet-draft:other-user:file:tab9');
		expect(storage.getItem('v10r:spreadsheet-draft:user:file:tab1')).not.toBeNull();
		reloaded.discard('v10r:spreadsheet-draft:user:file:broken');
		expect(storage.getItem('v10r:spreadsheet-draft:user:file:broken')).toBeNull();
	});

	it('stages input synchronously, commits on selection/closure, and saves Clear All', () => {
		const sheet = createSpreadsheetState();
		const change = vi.fn();
		const stage = vi.fn();
		sheet.onChange(change, stage);
		sheet.fromJSON(cells('loaded'));
		expect(change).not.toHaveBeenCalled();
		sheet.select(0, 0);
		sheet.startEditing();
		sheet.editValue = 'unfinished';
		expect(stage).toHaveBeenLastCalledWith(cells('unfinished'));
		sheet.select(1, 0);
		expect(change).toHaveBeenLastCalledWith(cells('unfinished'));
		sheet.startEditing();
		sheet.editValue = '=A1';
		sheet.commitEdit();
		expect(change.mock.lastCall?.[0].B1.f).toBe('=A1');
		sheet.clear();
		expect(change).toHaveBeenLastCalledWith({});
	});
});
