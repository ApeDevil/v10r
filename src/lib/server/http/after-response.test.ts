import { waitUntil } from '@vercel/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferAfterResponse } from './after-response';

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

const handedOver = vi.mocked(waitUntil);

describe('deferAfterResponse', () => {
	beforeEach(() => {
		handedOver.mockClear();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('hands the work to the platform so it survives the response', async () => {
		let ran = false;
		deferAfterResponse('analytics:pageview', async () => {
			ran = true;
		});

		expect(handedOver).toHaveBeenCalledTimes(1);
		await handedOver.mock.calls[0][0];
		expect(ran).toBe(true);
	});

	it('hands over an ALREADY-caught promise', async () => {
		deferAfterResponse('outbox:route', () => Promise.reject(new Error('neon down')));

		// The catch must be attached before handoff — an unhandled rejection here
		// takes the serverless process down (SvelteKit #9785), so awaiting what was
		// handed over must resolve, not reject.
		await expect(handedOver.mock.calls[0][0]).resolves.toBeUndefined();
		expect(console.error).toHaveBeenCalledWith('[after-response] outbox:route failed:', expect.any(Error));
	});

	it('swallows a synchronous throw that never became a promise', () => {
		deferAfterResponse('search:index', () => {
			throw new Error('bad config');
		});

		// Nothing was deferred, and the caller's response is unaffected.
		expect(handedOver).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledWith(
			'[after-response] search:index threw before deferral:',
			expect.any(Error),
		);
	});
});
