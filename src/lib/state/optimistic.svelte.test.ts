import { describe, expect, it, vi } from 'vitest';
import { isTemporaryId, OptimisticValue, temporaryId } from './optimistic.svelte';

/** A deferred the test resolves by hand, so "did the caller wait?" is observable. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (cause: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

interface Row {
	id: string;
	name: string;
}

const rename = (id: string, name: string) => (rows: Row[]) => rows.map((r) => (r.id === id ? { ...r, name } : r));

describe('OptimisticValue', () => {
	it('shows the change before the server has answered', async () => {
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'old' }]);
		const server = deferred<void>();

		const settled = value.mutate({ key: 'rename:1', apply: rename('1', 'new'), commit: () => server.promise });

		// The whole point: visible now, confirmed later.
		expect(value.current[0].name).toBe('new');
		expect(value.confirmed[0].name).toBe('old');
		expect(value.status).toBe('pending');

		server.resolve();
		await settled;

		expect(value.confirmed[0].name).toBe('new');
		expect(value.status).toBe('idle');
	});

	it('drops the settled intent instead of folding it a second time', () => {
		// Pins the observable contract: a settled intent is gone, and the view agrees with
		// the confirmed value.
		//
		// It does NOT guard the bug that motivated it, and saying so is the point. With
		// `$state` instead of `$state.raw` the pending array is deeply proxied, an entry
		// read back is a PROXY of the object that went in, and an identity filter never
		// removes it — so the intent keeps folding on top of a base that already absorbed
		// it and a successful toggle lands back where it started. Svelte only WARNS
		// (`state_proxy_equality_mismatch`), so the code runs on and lies. This suite
		// passes either way: vitest's node environment does not reproduce the proxying.
		// It was found in a browser, and only a browser can find the next one.
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'old' }]);

		return value.mutate({ key: 'rename:1', apply: rename('1', 'new'), commit: async () => {} }).then(() => {
			expect(value.pendingKeys).toEqual([]);
			expect(value.current[0].name).toBe('new');
			// Double-folding would show up here as the base and the view disagreeing.
			expect(value.current).toEqual(value.confirmed);
		});
	});

	it('re-folds correctly when the same key is mutated repeatedly', async () => {
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'a' }]);
		const bump = (to: string) => ({ key: 'rename:1', apply: rename('1', to), commit: async () => {} });

		await value.mutate(bump('b'));
		await value.mutate(bump('c'));
		await value.mutate(bump('d'));

		expect(value.current[0].name).toBe('d');
		expect(value.pendingKeys).toEqual([]);
	});

	it('rolls back exactly when the commit fails', async () => {
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'old' }]);

		const outcome = await value.mutate({
			key: 'rename:1',
			apply: rename('1', 'new'),
			commit: async () => {
				throw new Error('409 conflict');
			},
		});

		expect(outcome).toEqual({ ok: false, error: expect.any(Error) });
		expect(value.current[0].name).toBe('old');
		expect(value.status).toBe('error');
		expect(value.error?.message).toBe('409 conflict');
	});

	it('keeps later intents applied when an earlier one rolls back', async () => {
		const value = new OptimisticValue<Row[]>([
			{ id: '1', name: 'a' },
			{ id: '2', name: 'b' },
		]);
		const first = deferred<void>();

		const failing = value.mutate({ key: 'rename:1', apply: rename('1', 'A'), commit: () => first.promise });
		const succeeding = value.mutate({ key: 'rename:2', apply: rename('2', 'B'), commit: async () => {} });

		first.reject(new Error('nope'));
		await Promise.all([failing, succeeding]);

		// Undo-in-place would have clobbered row 2 as well. Re-folding cannot.
		expect(value.current).toEqual([
			{ id: '1', name: 'a' },
			{ id: '2', name: 'B' },
		]);
	});

	it('executes a repeated intent ONCE — the second caller joins the first', async () => {
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'old' }]);
		const commit = vi.fn(async () => {});

		const [a, b] = await Promise.all([
			value.mutate({ key: 'rename:1', apply: rename('1', 'new'), commit }),
			value.mutate({ key: 'rename:1', apply: rename('1', 'new'), commit }),
		]);

		// A double-clicked button must not rename twice.
		expect(commit).toHaveBeenCalledTimes(1);
		expect(a).toEqual({ ok: true });
		expect(b).toEqual({ ok: true });
		expect(value.current[0].name).toBe('new');
	});

	it('runs the same key again once the first has settled', async () => {
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'old' }]);
		const commit = vi.fn(async () => {});

		await value.mutate({ key: 'toggle:1', apply: (r) => r, commit });
		await value.mutate({ key: 'toggle:1', apply: (r) => r, commit });

		// Deduplication is for concurrency, not a permanent lockout.
		expect(commit).toHaveBeenCalledTimes(2);
	});

	it('adopts the server value over the optimistic one', async () => {
		const value = new OptimisticValue<Row[]>([{ id: 'tmp_x', name: 'draft' }]);

		await value.mutate({
			key: 'create:tmp_x',
			apply: (rows) => rows,
			// The server assigns the real id; the optimistic row carried a placeholder.
			commit: async () => [{ id: 'row_9', name: 'draft' }],
		});

		expect(value.current).toEqual([{ id: 'row_9', name: 'draft' }]);
	});

	it('re-folds pending intents over a reconcile from elsewhere', async () => {
		const value = new OptimisticValue<Row[]>([{ id: '1', name: 'old' }]);
		const server = deferred<void>();

		const settled = value.mutate({ key: 'rename:1', apply: rename('1', 'new'), commit: () => server.promise });
		// An unrelated refresh lands mid-flight.
		value.reconcile([{ id: '1', name: 'old-from-server' }]);

		// The in-flight rename must not flicker away.
		expect(value.current[0].name).toBe('new');

		server.resolve();
		await settled;
		expect(value.confirmed[0].name).toBe('new');
	});

	it('reports which keys are in flight', () => {
		const value = new OptimisticValue<Row[]>([]);
		const server = deferred<void>();

		void value.mutate({ key: 'move:3', apply: (r) => r, commit: () => server.promise });

		expect(value.pendingKeys).toEqual(['move:3']);
		expect(value.isPending('move:3')).toBe(true);
		expect(value.isPending('move:4')).toBe(false);
		server.resolve();
	});
});

describe('temporaryId', () => {
	it('round-trips through the recognizer', () => {
		expect(isTemporaryId(temporaryId())).toBe(true);
		expect(isTemporaryId(temporaryId('row'))).toBe(true);
	});

	it('does not mistake a server id for a placeholder', () => {
		expect(isTemporaryId('row_9')).toBe(false);
		expect(isTemporaryId('c8067140')).toBe(false);
	});
});
