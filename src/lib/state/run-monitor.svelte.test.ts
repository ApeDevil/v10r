/**
 * RunMonitor lifecycle — the leaks a browser test can't reliably catch:
 *   - polling STOPS on a terminal status (no runaway timer) and onDone fires once
 *   - seeding an already-terminal run finishes immediately, never polls
 *   - re-start()/seed() cancels the prior timer (no double polling)
 *   - stop() halts polling
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunMonitor } from './run-monitor.svelte';

function okJson(status: string): Response {
	return { ok: true, json: async () => ({ data: { id: 'r1', status, error: null } }) } as unknown as Response;
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('RunMonitor', () => {
	it('polls while running, then stops and fires onDone exactly once on terminal', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(okJson('running')).mockResolvedValueOnce(okJson('succeeded'));
		vi.stubGlobal('fetch', fetchMock);
		const onDone = vi.fn();

		const m = new RunMonitor();
		m.start('r1', onDone);
		expect(m.isPolling).toBe(true);

		await vi.advanceTimersByTimeAsync(1500); // first poll → still running
		expect(m.status).toBe('running');
		expect(m.isPolling).toBe(true);

		await vi.advanceTimersByTimeAsync(1500); // second poll → terminal
		expect(m.status).toBe('succeeded');
		expect(m.isPolling).toBe(false);
		expect(onDone).toHaveBeenCalledTimes(1);

		// no runaway polling after terminal
		fetchMock.mockClear();
		await vi.advanceTimersByTimeAsync(6000);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('seeding an already-terminal run finishes immediately and never polls', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const onDone = vi.fn();

		const m = new RunMonitor();
		m.seed({ id: 'r1', status: 'succeeded', error: null }, onDone);

		expect(m.isPolling).toBe(false);
		expect(onDone).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(6000);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('re-start cancels the previous timer (no double polling)', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson('running'));
		vi.stubGlobal('fetch', fetchMock);

		const m = new RunMonitor();
		m.start('r1');
		m.start('r2'); // must clear r1's pending poll

		await vi.advanceTimersByTimeAsync(1500);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('/api/admin/db/ops/r2');
	});

	it('stop() halts polling', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson('running'));
		vi.stubGlobal('fetch', fetchMock);

		const m = new RunMonitor();
		m.start('r1');
		m.stop();
		expect(m.isPolling).toBe(false);

		await vi.advanceTimersByTimeAsync(6000);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
