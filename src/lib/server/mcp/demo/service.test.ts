import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpDemoStateRow } from '$lib/server/db/schema/mcp';

/**
 * In-memory fake of the singleton row that models the service's compare-and-swap exactly: the
 * guarded UPDATE only succeeds when `patch.version - 1 === store.version` (i.e. nobody wrote
 * since the read). Two hooks let a test deterministically force CAS collisions:
 *   flags.injectCollisionOnce — a one-shot "concurrent writer" bumps the row between the read
 *                               and the write on the first update, so the guard misses once;
 *   flags.alwaysCollide       — every update misses, to exercise the retry-budget exhaustion.
 */
type AuditEntry = { action: string; actorEmail: string; occurredAt: string; detail: Record<string, unknown> };
type AuditPage = { entries: AuditEntry[]; total: number; page: number; totalPages: number };

const h = vi.hoisted(() => {
	let store: McpDemoStateRow | null = null;
	const flags = { injectCollisionOnce: false, alwaysCollide: false };
	const recordAuditEvent = vi.fn(async (_input: Record<string, unknown>) => {});
	const queryAuditLog = vi.fn(async (): Promise<AuditPage> => ({ entries: [], total: 0, page: 1, totalPages: 1 }));

	const db = {
		insert: () => ({
			values: (vals: Partial<McpDemoStateRow>) => ({
				onConflictDoNothing: async () => {
					if (!store) {
						store = {
							id: 'singleton',
							message: vals.message ?? 'Hello, Velociraptor.',
							color: vals.color ?? 'blue',
							version: 1,
							updatedAt: new Date('2020-01-01T00:00:00.000Z'),
							updatedBy: null,
						};
					}
				},
			}),
		}),
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => (store ? [{ ...store }] : []),
				}),
			}),
		}),
		update: () => ({
			set: (patch: Record<string, unknown>) => ({
				where: () => ({
					returning: async () => {
						if (!store) return [];
						if (flags.alwaysCollide) return [];
						if (flags.injectCollisionOnce) {
							flags.injectCollisionOnce = false;
							// A concurrent writer commits between our read and this update.
							store = {
								...store,
								version: store.version + 1,
								updatedBy: 'concurrent-writer',
								updatedAt: new Date('2020-06-01T00:00:00.000Z'),
							};
						}
						const expectedCurrent = (patch.version as number) - 1;
						if (store.version !== expectedCurrent) return []; // CAS guard miss
						store = {
							...store,
							...(typeof patch.message === 'string' ? { message: patch.message } : {}),
							...(typeof patch.color === 'string' ? { color: patch.color } : {}),
							version: patch.version as number,
							updatedAt: patch.updatedAt instanceof Date ? patch.updatedAt : new Date('2020-01-02T00:00:00.000Z'),
							updatedBy: (patch.updatedBy as string) ?? store.updatedBy,
						};
						return [{ ...store }];
					},
				}),
			}),
		}),
	};

	return {
		db,
		flags,
		recordAuditEvent,
		queryAuditLog,
		reset: () => {
			store = null;
			flags.injectCollisionOnce = false;
			flags.alwaysCollide = false;
			recordAuditEvent.mockClear();
			queryAuditLog.mockClear();
		},
	};
});

vi.mock('$lib/server/db', () => ({ db: h.db }));
vi.mock('$lib/server/admin/audit', () => ({
	recordAuditEvent: h.recordAuditEvent,
	queryAuditLog: h.queryAuditLog,
}));

const { getDemoState, setDemoMessage, setDemoColor, resetDemoState, getDemoHistory } = await import('./service');

const ACTOR = { id: 'admin-mcp', email: 'admin-mcp@velociraptor.local', label: 'admin-mcp' };
const NUL = String.fromCharCode(0);

beforeEach(() => h.reset());

describe('getDemoState', () => {
	it('lazily provisions the seed state on first read', async () => {
		const state = await getDemoState();
		expect(state.message).toBe('Hello, Velociraptor.');
		expect(state.color).toBe('blue');
		expect(state.version).toBe(1);
		expect(state.updatedAt).toBe('2020-01-01T00:00:00.000Z');
	});
});

describe('setDemoMessage', () => {
	it('accepts a valid message, increments version, returns before/after', async () => {
		await getDemoState();
		const result = await setDemoMessage('Hello, world', ACTOR);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.field).toBe('message');
		expect(result.before.version).toBe(1);
		expect(result.after.version).toBe(2);
		expect(result.after.message).toBe('Hello, world');
		expect(result.after.updatedBy).toBe('admin-mcp');
		expect(h.recordAuditEvent).toHaveBeenCalledTimes(1);
		expect(h.recordAuditEvent.mock.calls[0][0]).toMatchObject({
			action: 'mcp.set_message',
			targetType: 'mcp_demo_state',
		});
	});

	it('rejects an empty message with no state change', async () => {
		await getDemoState();
		const result = await setDemoMessage('', ACTOR);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.code).toBe('invalid_message');
		expect((await getDemoState()).version).toBe(1);
		expect(h.recordAuditEvent).not.toHaveBeenCalled();
	});

	it('rejects an over-500-character message', async () => {
		const result = await setDemoMessage('x'.repeat(501), ACTOR);
		expect(result.ok).toBe(false);
	});

	it('rejects control characters (e.g. NUL)', async () => {
		const result = await setDemoMessage(`bad${NUL}byte`, ACTOR);
		expect(result.ok).toBe(false);
	});

	it('rejects non-string input', async () => {
		const result = await setDemoMessage(42, ACTOR);
		expect(result.ok).toBe(false);
	});
});

describe('setDemoColor', () => {
	it('accepts an allowlisted color', async () => {
		const result = await setDemoColor('red', ACTOR);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.after.color).toBe('red');
		expect(result.after.version).toBe(2);
	});

	it('rejects an unsupported color with no state change', async () => {
		await getDemoState();
		const result = await setDemoColor('chartreuse', ACTOR);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.code).toBe('invalid_color');
		expect((await getDemoState()).color).toBe('blue');
	});

	it('accepts each allowlisted color and rejects near-misses', async () => {
		for (const color of ['blue', 'red', 'green', 'yellow', 'orange', 'purple']) {
			expect((await setDemoColor(color, ACTOR)).ok).toBe(true);
		}
		expect((await setDemoColor('BLUE', ACTOR)).ok).toBe(false);
		expect((await setDemoColor('', ACTOR)).ok).toBe(false);
	});
});

describe('optimistic concurrency (compare-and-swap)', () => {
	it('retries a CAS collision and returns the true immediate predecessor of the result', async () => {
		await getDemoState(); // version 1
		h.flags.injectCollisionOnce = true;
		const result = await setDemoColor('red', ACTOR);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		// attempt 1 reads v1 → a concurrent writer bumps to v2 → guard misses → retry reads v2 → swaps to v3.
		expect(result.before.version).toBe(2);
		expect(result.before.updatedBy).toBe('concurrent-writer'); // `before` is the concurrent predecessor, not v1
		expect(result.after.version).toBe(3);
		expect(result.after.color).toBe('red');
		expect(result.after.version).toBe(result.before.version + 1);
		expect(h.recordAuditEvent).toHaveBeenCalledTimes(1); // audited only on the successful swap
	});

	it('returns a conflict (no partial write, no audit) after exhausting the retry budget', async () => {
		await getDemoState();
		h.flags.alwaysCollide = true;
		const result = await setDemoColor('red', ACTOR);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected conflict');
		expect(result.code).toBe('conflict');
		expect(h.recordAuditEvent).not.toHaveBeenCalled();
	});
});

describe('resetDemoState', () => {
	it('restores seed values and still bumps the version', async () => {
		await setDemoColor('purple', ACTOR);
		await setDemoMessage('changed', ACTOR);
		const result = await resetDemoState(ACTOR);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.after.message).toBe('Hello, Velociraptor.');
		expect(result.after.color).toBe('blue');
		expect(result.after.version).toBe(result.before.version + 1);
	});
});

describe('getDemoHistory', () => {
	it('maps audit-log entries to history rows with before AND after', async () => {
		h.queryAuditLog.mockResolvedValueOnce({
			entries: [
				{
					action: 'mcp.set_color',
					actorEmail: 'admin-mcp@velociraptor.local',
					occurredAt: '2020-01-02T00:00:00.000Z',
					detail: {
						before: { message: 'Hello, Velociraptor.', color: 'blue', version: 1 },
						after: { message: 'Hello, Velociraptor.', color: 'red', version: 2 },
					},
				},
			],
			total: 1,
			page: 1,
			totalPages: 1,
		});
		const history = await getDemoHistory(5);
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			field: 'set_color',
			before: { color: 'blue', version: 1 },
			after: { color: 'red', version: 2 },
		});
	});
});
