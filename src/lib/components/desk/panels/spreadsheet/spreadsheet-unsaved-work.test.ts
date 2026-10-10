import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpreadsheetAutosave } from './spreadsheet-autosave';
import { createSpreadsheetDrafts, removeUserSpreadsheetDrafts, userSpreadsheetDraftFiles } from './spreadsheet-drafts';
import { openSpreadsheetSession, spreadsheetUnsavedWork } from './spreadsheet-unsaved-work';

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		key: (index) => [...items.keys()][index] ?? null,
		getItem: (key) => items.get(key) ?? null,
		setItem: (key, value) => void items.set(key, value),
		removeItem: (key) => void items.delete(key),
		clear: () => items.clear(),
	};
}

/** A real autosave over the given storage; `save` decides whether the server accepts. */
function openSheet(storage: Storage, userId: string, fileId: string, save: () => Promise<unknown>) {
	const commitEdit = vi.fn();
	const session = openSpreadsheetSession(userId, fileId, () => ({
		sheet: { commitEdit },
		autosave: createSpreadsheetAutosave({
			drafts: createSpreadsheetDrafts(() => storage, userId, fileId, 'tab'),
			apply: () => {},
			load: async () => ({ cells: {}, version: 0 }),
			save: async ({ version }) => {
				await save();
				return { status: 'saved', version: version + 1 };
			},
		}),
	}));
	return { ...session, commitEdit };
}

// Edits schedule a debounced save; fake timers keep it from firing after a test ends.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('user draft slots', () => {
	it('lists and removes one user’s slots across files and writers, leaving other users alone', () => {
		const storage = memoryStorage();
		createSpreadsheetDrafts(() => storage, 'a', 'f1', 'tab1').write(0, {});
		createSpreadsheetDrafts(() => storage, 'a', 'f1', 'tab2').write(0, {});
		createSpreadsheetDrafts(() => storage, 'a', 'f:2', 'tab1').write(0, {});
		// 'ab' shares a string prefix with 'a' but is a different user.
		createSpreadsheetDrafts(() => storage, 'ab', 'f1', 'tab1').write(0, {});
		storage.setItem('theme', 'dark');

		expect(userSpreadsheetDraftFiles(storage, 'a')).toEqual(new Set(['f1', 'f:2']));

		removeUserSpreadsheetDrafts(storage, 'a');
		expect(userSpreadsheetDraftFiles(storage, 'a').size).toBe(0);
		expect(userSpreadsheetDraftFiles(storage, 'ab')).toEqual(new Set(['f1']));
		expect(storage.getItem('theme')).toBe('dark');
	});
});

describe('spreadsheet unsaved work', () => {
	it('drain delivers a pending edit, after which nothing is left to lose', async () => {
		const storage = memoryStorage();
		const sheet = openSheet(storage, 'u-saved', 'file', async () => {});
		await sheet.autosave.refresh();
		sheet.autosave.change({ A1: { v: 'typed' } });
		const work = spreadsheetUnsavedWork('u-saved', () => storage);
		expect(work.count()).toBe(1);

		await work.drain();

		expect(sheet.commitEdit).toHaveBeenCalled();
		expect(work.count()).toBe(0);
	});

	it('a failed save stays counted; discard erases the slot and forgets the session', async () => {
		const storage = memoryStorage();
		const sheet = openSheet(storage, 'u-failed', 'file', async () => {
			throw new Error('offline');
		});
		await sheet.autosave.refresh();
		sheet.autosave.change({ A1: { v: 'typed' } });
		const work = spreadsheetUnsavedWork('u-failed', () => storage);

		await work.drain();
		expect(work.count()).toBe(1);

		work.discard();
		expect(userSpreadsheetDraftFiles(storage, 'u-failed').size).toBe(0);
		// The tab's next session for this file starts clean instead of reusing the edits.
		const create = vi.fn(() => openSheet(storage, 'other', 'x', async () => {}));
		openSpreadsheetSession('u-failed', 'file', create);
		expect(create).toHaveBeenCalledOnce();
	});

	it('counts each file once: orphaned slots from other tabs plus open sessions whose backup failed', async () => {
		const storage = memoryStorage();
		createSpreadsheetDrafts(() => storage, 'u-union', 'orphan', 'old-tab').write(3, { A1: { v: 'x' } });
		createSpreadsheetDrafts(() => storage, 'u-union', 'open', 'other-tab').write(1, {});
		createSpreadsheetDrafts(() => storage, 'someone-else', 'theirs', 'tab').write(0, {});

		const full: Storage = {
			...memoryStorage(),
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
		};
		const open = openSheet(full, 'u-union', 'open', async () => {
			throw new Error('offline');
		});
		const unbacked = openSheet(full, 'u-union', 'unbacked', async () => {
			throw new Error('offline');
		});
		for (const sheet of [open, unbacked]) {
			await sheet.autosave.refresh();
			sheet.autosave.change({ A1: { v: 'typed' } });
		}

		expect(spreadsheetUnsavedWork('u-union', () => storage).count()).toBe(3); // orphan, open, unbacked
	});

	it('an unavailable storage still counts the in-memory work', async () => {
		const sheet = openSheet(memoryStorage(), 'u-nostore', 'file', async () => {
			throw new Error('offline');
		});
		await sheet.autosave.refresh();
		sheet.autosave.change({ A1: { v: 'typed' } });
		const work = spreadsheetUnsavedWork('u-nostore', () => {
			throw new Error('SecurityError');
		});
		expect(work.count()).toBe(1);
	});
});
