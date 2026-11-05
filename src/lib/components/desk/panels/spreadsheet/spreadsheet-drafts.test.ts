import { describe, expect, it, vi } from 'vitest';
import { createSpreadsheetState } from './spreadsheet.state.svelte';
import { createSpreadsheetDrafts } from './spreadsheet-drafts';

const cells = (v: string) => ({ A1: { v } });

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
		expect(second.list()).toMatchObject([{ content: cells('first'), version: 0 }]);
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
