import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentAutosave } from './document-autosave.ts';
import type { DocumentDraft } from './document-drafts.ts';

type Cells = Record<string, { v: string }>;
const cells = (v: string): Cells => ({ A1: { v } });
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function fixture() {
	const load = vi.fn(async () => ({ content: cells('server'), version: 0 }));
	const save = vi.fn(async ({ version }: { version: number }) => ({ status: 'saved' as const, version: version + 1 }));
	const drafts = { write: vi.fn(), clear: vi.fn(), discard: vi.fn(), list: vi.fn(() => [] as DocumentDraft<Cells>[]) };
	const apply = vi.fn();
	const autosave = createDocumentAutosave<Cells>({ load, save, drafts, apply });
	return { autosave, load, save, drafts, apply };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('document autosave lifecycle', () => {
	it('backs up immediately and debounces rapid edits to one latest snapshot', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.autosave.change(cells('first'));
		f.autosave.change(cells('latest'));
		expect(f.drafts.write).toHaveBeenLastCalledWith(0, cells('latest'));
		expect(f.save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1500);
		expect(f.save).toHaveBeenCalledExactlyOnceWith({ content: cells('latest'), version: 0 });
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
		expect(f.save).toHaveBeenLastCalledWith({ content: cells('second'), version: 1 });
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
		expect(f.save).toHaveBeenCalledExactlyOnceWith({ content: cells('closing'), version: 0 });
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
		expect(f.save).toHaveBeenLastCalledWith({ content: cells('offline'), version: 0 });
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
		f.load.mockResolvedValue({ content: cells('AI'), version: 1 });
		await f.autosave.refresh();
		expect(f.apply).toHaveBeenCalledTimes(1);
		expect(f.autosave.draft.content).toEqual(cells('local'));
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
		const old = deferred<{ content: ReturnType<typeof cells>; version: number }>();
		f.load.mockReturnValueOnce(old.promise);
		const refresh = f.autosave.refresh();
		f.load.mockResolvedValueOnce({ content: cells('newer'), version: 2 });
		await f.autosave.refresh();
		old.resolve({ content: cells('older'), version: 1 });
		await refresh;
		expect(f.autosave.draft).toEqual({ content: cells('newer'), version: 2 });
		const racing = deferred<{ content: ReturnType<typeof cells>; version: number }>();
		f.load.mockReturnValueOnce(racing.promise);
		const raced = f.autosave.refresh();
		f.autosave.change(cells('typed'));
		racing.resolve({ content: cells('remote'), version: 3 });
		await raced;
		expect(f.autosave.draft.content).toEqual(cells('typed'));
	});

	it('does not discard local work when reload fails or the user edits during reload', async () => {
		const f = fixture();
		await f.autosave.refresh();
		f.autosave.change(cells('local'));
		f.load.mockRejectedValueOnce(new Error('offline'));
		await f.autosave.discardAndReload();
		expect(f.autosave.draft.content).toEqual(cells('local'));
		const reload = deferred<{ content: ReturnType<typeof cells>; version: number }>();
		f.load.mockReturnValueOnce(reload.promise);
		const discarding = f.autosave.discardAndReload();
		f.autosave.change(cells('new edit'));
		reload.resolve({ content: cells('reloaded'), version: 0 });
		await discarding;
		expect(f.autosave.draft.content).toEqual(cells('new edit'));
	});

	it('recovers stale drafts without rebasing or silently overwriting another tab', async () => {
		const f = fixture();
		f.load.mockResolvedValue({ content: cells('new server'), version: 4 });
		await f.autosave.refresh();
		f.autosave.recover({ key: 'old tab', content: cells('draft'), version: 2, updatedAt: 1 });
		await vi.advanceTimersByTimeAsync(2000);
		expect(f.autosave.snapshot).toMatchObject({ conflict: true, unsaved: true });
		expect(f.autosave.draft).toEqual({ content: cells('draft'), version: 2 });
		expect(f.save).not.toHaveBeenCalled();
	});

	it('stops the losing tab on 409 and keeps its local draft through edits and retries', async () => {
		let serverVersion = 0;
		let serverCells: Cells = cells('server');
		const makeTab = () =>
			createDocumentAutosave<Cells>({
				load: async () => ({ content: serverCells, version: serverVersion }),
				save: async ({ content: next, version }) => {
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
		expect(second.draft.content).toEqual(cells('second, more edits'));
	});

	it('stops offering a draft once it is recovered or dismissed', async () => {
		const f = fixture();
		const stale: DocumentDraft<Cells> = { key: 'other-tab', content: cells('draft'), version: 0, updatedAt: 2 };
		const orphan: DocumentDraft<Cells> = { key: 'abandoned-tab', content: cells('orphan'), version: 0, updatedAt: 1 };
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
		expect(f.save).toHaveBeenCalledExactlyOnceWith({ content: cells('committed'), version: 0 });
		expect(f.drafts.write).toHaveBeenLastCalledWith(1, cells('still typing'));
		expect(f.autosave.snapshot.unsaved).toBe(true);
		f.autosave.stage(null);
		expect(f.autosave.snapshot.unsaved).toBe(false);
	});

	describe('rebase', () => {
		const merge = (base: Cells, local: Cells, remote: Cells): Cells | null => {
			const out: Cells = { ...remote };
			for (const key of Object.keys(local)) {
				if (local[key]?.v === base[key]?.v) continue;
				if (remote[key] && remote[key].v !== base[key]?.v && remote[key].v !== local[key].v) return null;
				out[key] = local[key];
			}
			return out;
		};

		it('merges against the confirmed base and saves on top of the remote version', async () => {
			const f = fixture();
			f.load.mockResolvedValue({ content: { A1: { v: 'server' } }, version: 0 });
			await f.autosave.refresh();
			f.save.mockResolvedValueOnce({ status: 'conflict' as never, version: 0 });
			f.autosave.change({ A1: { v: 'server' }, B1: { v: 'mine' } });
			await f.autosave.flush();
			expect(f.autosave.snapshot).toMatchObject({ conflict: true, canRebase: true });

			f.load.mockResolvedValue({ content: { A1: { v: 'theirs' } }, version: 3 });
			f.save.mockImplementation(async ({ version }: { version: number }) => ({
				status: 'saved',
				version: version + 1,
			}));
			expect(await f.autosave.rebase(merge)).toBe('merged');
			expect(f.save).toHaveBeenLastCalledWith({ content: { A1: { v: 'theirs' }, B1: { v: 'mine' } }, version: 3 });
			expect(f.apply).toHaveBeenLastCalledWith({ A1: { v: 'theirs' }, B1: { v: 'mine' } });
			expect(f.autosave.snapshot).toMatchObject({ conflict: false, unsaved: false });
		});

		it('stays in conflict and changes nothing when the merge refuses', async () => {
			const f = fixture();
			await f.autosave.refresh();
			f.save.mockResolvedValueOnce({ status: 'conflict' as never, version: 0 });
			f.autosave.change(cells('mine'));
			await f.autosave.flush();
			f.load.mockResolvedValue({ content: cells('theirs'), version: 1 });
			expect(await f.autosave.rebase(merge)).toBe('unresolved');
			expect(f.autosave.snapshot).toMatchObject({ conflict: true, unsaved: true });
			expect(f.autosave.draft).toEqual({ content: cells('mine'), version: 0 });
		});

		it('refuses without a known base (a stale draft was adopted) and when the load fails', async () => {
			const f = fixture();
			f.load.mockResolvedValue({ content: cells('server'), version: 4 });
			await f.autosave.refresh();
			f.autosave.recover({ key: 'old', content: cells('draft'), version: 2, updatedAt: 1 });
			expect(f.autosave.snapshot).toMatchObject({ conflict: true, canRebase: false });
			expect(await f.autosave.rebase(merge)).toBe('unresolved');

			const g = fixture();
			await g.autosave.refresh();
			g.save.mockResolvedValueOnce({ status: 'conflict' as never, version: 0 });
			g.autosave.change(cells('mine'));
			await g.autosave.flush();
			g.load.mockRejectedValue(new Error('offline'));
			expect(await g.autosave.rebase(merge)).toBe('failed');
			expect(g.autosave.snapshot).toMatchObject({ conflict: true, error: true, unsaved: true });
		});
	});
});
