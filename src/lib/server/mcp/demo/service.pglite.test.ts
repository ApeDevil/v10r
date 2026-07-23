import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '$lib/server/test/db';

/**
 * Concurrency regression test against a REAL Postgres (PGlite) with the full schema pushed —
 * the project-native DB test approach. It proves:
 *  - correct monotonic versioning + exact before/after against real SQL,
 *  - best-effort audit rows actually persist on the happy path,
 *  - a prior concurrent write is observed (before/after stay correct),
 *  - a mid-operation compare-and-swap collision is retried and still returns the TRUE immediate
 *    predecessor (the guarded UPDATE misses, the service re-reads and swaps).
 *
 * The service reads `db` from `$lib/server/db`; we proxy that to the live PGlite handle so the
 * service, and the audit module it calls, both run against the same real database.
 */
type Db = Awaited<ReturnType<typeof createTestDb>>['db'];
type Client = Awaited<ReturnType<typeof createTestDb>>['client'];

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('$lib/server/db', () => ({
	db: new Proxy(
		{},
		{
			get(_t, prop) {
				if (typeof prop === 'symbol') return undefined;
				const target = holder.db as Record<string, unknown> | null;
				const value = target?.[prop];
				return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
			},
		},
	),
}));

const { getDemoState, setDemoColor, setDemoMessage, getDemoHistory } = await import('./service');

const ACTOR = { id: 'admin-mcp', email: 'admin-mcp@velociraptor.local', label: 'admin-mcp' };

let db: Db;
let client: Client;

/**
 * Wrap the real db so the FIRST `select(...).limit()` returns its rows and THEN a concurrent
 * writer bumps the row — deterministically forcing the next guarded UPDATE to miss (one-shot).
 */
function makeCollidingDb(realDb: Db, pg: Client): Db {
	let injected = false;
	const wrapBuilder = (obj: object): unknown =>
		new Proxy(obj, {
			get(target, prop, recv) {
				const value = Reflect.get(target, prop, recv);
				if (typeof value !== 'function') return value;
				return (...args: unknown[]) => {
					const out = (value as (...a: unknown[]) => unknown).apply(target, args);
					if (prop === 'limit') {
						return (async () => {
							const rows = await out;
							if (!injected) {
								injected = true;
								await pg.exec(
									"UPDATE mcp.demo_state SET version = version + 1, updated_by = 'concurrent' WHERE id = 'singleton'",
								);
							}
							return rows;
						})();
					}
					return out && typeof out === 'object' ? wrapBuilder(out) : out;
				};
			},
		});
	return new Proxy(realDb as object, {
		get(target, prop, recv) {
			const value = Reflect.get(target, prop, recv);
			if (prop === 'select' && typeof value === 'function') {
				return (...args: unknown[]) =>
					wrapBuilder((value as (...a: unknown[]) => unknown).apply(target, args) as object);
			}
			return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
		},
	}) as Db;
}

async function auditCount(): Promise<number> {
	const result = (await client.query(
		"SELECT count(*)::int AS n FROM admin.audit_log WHERE target_type = 'mcp_demo_state'",
	)) as { rows: Array<{ n: number }> };
	return result.rows[0]?.n ?? 0;
}

beforeAll(async () => {
	const created = await createTestDb();
	db = created.db;
	client = created.client;
	holder.db = db;
});

afterAll(async () => {
	await client.close();
});

beforeEach(async () => {
	holder.db = db;
	await client.exec('DELETE FROM mcp.demo_state; DELETE FROM admin.audit_log;');
});

describe('demo-state service against real Postgres (PGlite)', () => {
	it('seeds v1 and versions monotonically with exact before/after', async () => {
		expect((await getDemoState()).version).toBe(1);

		const first = await setDemoColor('red', ACTOR);
		expect(first.ok).toBe(true);
		if (!first.ok) throw new Error('expected ok');
		expect(first.before).toMatchObject({ version: 1, color: 'blue' });
		expect(first.after).toMatchObject({ version: 2, color: 'red' });

		const second = await setDemoMessage('Hello, world', ACTOR);
		expect(second.ok).toBe(true);
		if (!second.ok) throw new Error('expected ok');
		expect(second.before).toMatchObject({ version: 2, message: 'Hello, Velociraptor.' });
		expect(second.after).toMatchObject({ version: 3, message: 'Hello, world' });
	});

	it('persists best-effort audit rows and reads them back with before/after', async () => {
		await getDemoState();
		await setDemoColor('green', ACTOR);
		await setDemoMessage('audited', ACTOR);
		expect(await auditCount()).toBe(2);

		const history = await getDemoHistory(10);
		expect(history).toHaveLength(2);
		// newest first
		expect(history[0]).toMatchObject({ field: 'set_message', after: { message: 'audited', version: 3 } });
		expect(history[1]).toMatchObject({ field: 'set_color', after: { color: 'green', version: 2 } });
	});

	it('observes a prior concurrent write in before/after', async () => {
		await getDemoState(); // v1
		await client.exec("UPDATE mcp.demo_state SET version = version + 1, updated_by = 'other' WHERE id = 'singleton'");
		const result = await setDemoColor('purple', ACTOR);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.before).toMatchObject({ version: 2, updatedBy: 'other' });
		expect(result.after).toMatchObject({ version: 3, color: 'purple' });
	});

	it('retries a real mid-operation CAS collision and returns the true predecessor', async () => {
		await getDemoState(); // v1
		holder.db = makeCollidingDb(db, client);
		const result = await setDemoColor('yellow', ACTOR);
		holder.db = db;

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok after retry');
		// first read v1 → concurrent writer bumps to v2 → guarded UPDATE misses → re-read v2 → swap to v3
		expect(result.before).toMatchObject({ version: 2, updatedBy: 'concurrent' });
		expect(result.after).toMatchObject({ version: 3, color: 'yellow' });
		expect(result.after.version).toBe(result.before.version + 1);

		// the persisted row reflects the retried, successful swap
		const live = await getDemoState();
		expect(live).toMatchObject({ version: 3, color: 'yellow', updatedBy: 'admin-mcp' });
	});
});
