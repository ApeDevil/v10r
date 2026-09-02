/**
 * Scheduled refresh flag-gate. The worst-case failure here is a surprise auto-wipe
 * of an actively-used dev branch, so the gate must be strict and must short-circuit
 * BEFORE any DB insert or Neon call. `DBOPS_AUTO_REFRESH_ENABLED` must equal the
 * literal string "true" — nothing else (unset, "false", "TRUE") may enable it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startOperation = vi.fn(async (..._a: unknown[]) => ({
	operation: { id: 'r1', status: 'succeeded' },
	replayed: false,
}));
const advanceOperation = vi.fn();
const neonConfigured = vi.fn(() => true);

vi.mock('$lib/server/dbops', () => ({
	startOperation: (...a: unknown[]) => startOperation(...a),
	advanceOperation: (...a: unknown[]) => advanceOperation(...a),
	isTerminal: (s: string) => ['succeeded', 'failed', 'canceled'].includes(s),
	ConflictError: class ConflictError extends Error {},
}));

vi.mock('$lib/server/neon', () => ({ neonConfigured: () => neonConfigured() }));

const { dbopsRefresh } = await import('./dbops-refresh');

beforeEach(() => {
	vi.clearAllMocks();
	neonConfigured.mockReturnValue(true);
});

afterEach(() => {
	delete process.env.DBOPS_AUTO_REFRESH_ENABLED;
});

describe('dbopsRefresh — flag gate', () => {
	it('returns 0 and touches nothing when the flag is unset', async () => {
		delete process.env.DBOPS_AUTO_REFRESH_ENABLED;
		expect(await dbopsRefresh()).toBe(0);
		expect(neonConfigured).not.toHaveBeenCalled(); // gated out before the neon check
		expect(startOperation).not.toHaveBeenCalled();
	});

	it('returns 0 when the flag is the string "false"', async () => {
		process.env.DBOPS_AUTO_REFRESH_ENABLED = 'false';
		expect(await dbopsRefresh()).toBe(0);
		expect(startOperation).not.toHaveBeenCalled();
	});

	it('is strict — "TRUE" (wrong case) does not enable it', async () => {
		process.env.DBOPS_AUTO_REFRESH_ENABLED = 'TRUE';
		expect(await dbopsRefresh()).toBe(0);
		expect(startOperation).not.toHaveBeenCalled();
	});

	it('with the flag on but Neon unconfigured, returns 0 without starting an operation', async () => {
		process.env.DBOPS_AUTO_REFRESH_ENABLED = 'true';
		neonConfigured.mockReturnValue(false);
		expect(await dbopsRefresh()).toBe(0);
		expect(neonConfigured).toHaveBeenCalled();
		expect(startOperation).not.toHaveBeenCalled();
	});
});
