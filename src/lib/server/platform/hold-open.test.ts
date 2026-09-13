import { waitUntil } from '@vercel/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { holdOpenUntil } from './hold-open';

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

const handedOver = vi.mocked(waitUntil);

describe('holdOpenUntil', () => {
	beforeEach(() => {
		handedOver.mockClear();
	});

	it('hands the in-flight promise to the platform and settles with it', async () => {
		const turn = Promise.withResolvers<string>();
		holdOpenUntil(turn.promise);
		expect(handedOver).toHaveBeenCalledTimes(1);
		let settled = false;
		void (handedOver.mock.calls[0][0] as Promise<unknown>).then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		turn.resolve('done');
		await handedOver.mock.calls[0][0];
		expect(settled).toBe(true);
	});

	it('hands over an already-caught copy — the awaiter owns the failure', async () => {
		const failing = Promise.reject(new Error('provider down'));
		failing.catch(() => {});
		holdOpenUntil(failing);
		await expect(handedOver.mock.calls[0][0]).resolves.toBeUndefined();
	});
});
