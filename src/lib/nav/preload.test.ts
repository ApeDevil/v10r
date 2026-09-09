import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadCode, preloadData } from '$app/navigation';
import { type PreloadIntent, preloadAttributes, preloadNow, preloadOnIdle } from './preload';

vi.mock('$app/navigation', () => ({ preloadCode: vi.fn(), preloadData: vi.fn() }));

const code = vi.mocked(preloadCode);
const data = vi.mocked(preloadData);

const INTENTS: PreloadIntent[] = ['none', 'code', 'data', 'code-data', 'idle'];

describe('preloadAttributes', () => {
	it('covers every intent', () => {
		for (const intent of INTENTS) {
			const attrs = preloadAttributes(intent);
			expect(attrs['data-sveltekit-preload-data']).toBeDefined();
			expect(attrs['data-sveltekit-preload-code']).toBeDefined();
		}
	});

	it('never fetches DATA merely because a link entered the viewport', () => {
		// Forty links on a page would be forty route loads for a user who scrolled past.
		for (const intent of INTENTS) {
			expect(preloadAttributes(intent)['data-sveltekit-preload-data']).not.toBe('viewport');
		}
	});

	it('turns everything off for `none`', () => {
		expect(preloadAttributes('none')).toEqual({
			'data-sveltekit-preload-data': 'off',
			'data-sveltekit-preload-code': 'off',
		});
	});

	it('warms code without touching the server for `code`', () => {
		const attrs = preloadAttributes('code');
		expect(attrs['data-sveltekit-preload-code']).toBe('viewport');
		expect(attrs['data-sveltekit-preload-data']).toBe('off');
	});
});

describe('preloadNow', () => {
	beforeEach(() => {
		code.mockReset().mockResolvedValue(undefined);
		data.mockReset().mockResolvedValue({ type: 'loaded', status: 200, data: {} });
	});

	it('does nothing at all for `none`', async () => {
		await preloadNow('/x', 'none');
		expect(code).not.toHaveBeenCalled();
		expect(data).not.toHaveBeenCalled();
	});

	it('loads only the chunk for `code`', async () => {
		await preloadNow('/x', 'code');
		expect(code).toHaveBeenCalledWith('/x');
		expect(data).not.toHaveBeenCalled();
	});

	it('loads data (which brings the code with it) for `code-data`', async () => {
		await preloadNow('/x', 'code-data');
		expect(data).toHaveBeenCalledWith('/x');
		expect(code).not.toHaveBeenCalled();
	});

	it('swallows a failed guess — speculation is never load-bearing', async () => {
		data.mockRejectedValue(new Error('offline'));
		await expect(preloadNow('/x', 'data')).resolves.toBeUndefined();
	});
});

describe('preloadOnIdle', () => {
	beforeEach(() => {
		code.mockReset().mockResolvedValue(undefined);
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'window');
	});

	/** Node has no `window`; these tests supply the narrow slice this module touches. */
	function installWindow(withIdleCallback: boolean): void {
		const fake: Record<string, unknown> = {
			setTimeout: globalThis.setTimeout.bind(globalThis),
			clearTimeout: globalThis.clearTimeout.bind(globalThis),
		};
		if (withIdleCallback) {
			fake.requestIdleCallback = (cb: () => void) => globalThis.setTimeout(cb, 0) as unknown as number;
			fake.cancelIdleCallback = (handle: number) => globalThis.clearTimeout(handle);
		}
		Object.defineProperty(globalThis, 'window', { value: fake, configurable: true, writable: true });
	}

	it('does nothing under SSR, where there is no idle to wait for', () => {
		expect(globalThis.window).toBeUndefined();
		expect(() => preloadOnIdle('/x', 'code')()).not.toThrow();
		expect(code).not.toHaveBeenCalled();
	});

	it('returns a no-op canceller for `none`', () => {
		installWindow(true);
		expect(() => preloadOnIdle('/x', 'none')()).not.toThrow();
		expect(code).not.toHaveBeenCalled();
	});

	it('preloads once the browser reports idle', async () => {
		vi.useFakeTimers();
		installWindow(true);

		preloadOnIdle('/x', 'code');
		expect(code).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(code).toHaveBeenCalledWith('/x');
		vi.useRealTimers();
	});

	it('falls back to a timer where requestIdleCallback is missing (Safari)', async () => {
		vi.useFakeTimers();
		installWindow(false);

		preloadOnIdle('/x', 'code');
		expect(code).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1500);

		// Late rather than never — the right failure for work nobody waits on.
		expect(code).toHaveBeenCalledWith('/x');
		vi.useRealTimers();
	});

	it('cancels scheduled work so a navigation away leaves nothing behind', async () => {
		vi.useFakeTimers();
		installWindow(false);

		preloadOnIdle('/x', 'code')();
		await vi.advanceTimersByTimeAsync(5000);

		expect(code).not.toHaveBeenCalled();
		vi.useRealTimers();
	});
});
