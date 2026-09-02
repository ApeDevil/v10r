/**
 * Transport selection for the SSE notification stream.
 *
 * The bug this guards: on Vercel each lambda has its own module scope, so the
 * in-memory registry can never reach a stream held by another instance. The
 * choice between "enqueue locally" and "publish to Redis" is therefore the
 * whole correctness story, and it is decided by `platform.persistent` — which
 * is `true` in this container. A test that ran against the real platform module
 * would exercise only the branch that was never broken.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformMock = { id: 'container', persistent: true };
const redisMock = { publish: vi.fn(), subscribe: vi.fn() };
let redisValue: unknown = redisMock;

vi.mock('$lib/server/platform', () => ({
	get platform() {
		return platformMock;
	},
}));

vi.mock('$lib/server/cache', () => ({
	get redis() {
		return redisValue;
	},
}));

const { encodeEvent, enqueueLocal, notifyUser, registerStream, subscribeUser, unregisterStream, usesPubSub } =
	await import('./stream');
const { SSE_MAX_PER_USER } = await import('./config');

/** Minimal stand-in for a ReadableStream controller. */
function fakeController() {
	const frames: string[] = [];
	const decoder = new TextDecoder();
	return {
		frames,
		controller: {
			enqueue: (chunk: Uint8Array) => frames.push(decoder.decode(chunk)),
		} as unknown as ReadableStreamDefaultController<Uint8Array>,
	};
}

function setPlatform(persistent: boolean) {
	platformMock.persistent = persistent;
}

beforeEach(() => {
	redisMock.publish.mockReset().mockResolvedValue(1);
	redisMock.subscribe.mockReset();
	redisValue = redisMock;
	setPlatform(true);
});

describe('encodeEvent', () => {
	it('emits a named event when the payload carries a type', () => {
		expect(new TextDecoder().decode(encodeEvent({ type: 'new', n: 1 }))).toBe(
			'event: new\ndata: {"type":"new","n":1}\n\n',
		);
	});

	it('emits an anonymous frame when it does not', () => {
		expect(new TextDecoder().decode(encodeEvent({ n: 1 }))).toBe('data: {"n":1}\n\n');
	});
});

describe('transport selection', () => {
	it('persistent host uses the in-memory registry, never Redis', async () => {
		const { frames, controller } = fakeController();
		registerStream('u1', controller);

		expect(usesPubSub()).toBe(false);
		await notifyUser('u1', { type: 'new' });

		expect(frames).toEqual(['event: new\ndata: {"type":"new"}\n\n']);
		expect(redisMock.publish).not.toHaveBeenCalled();
		unregisterStream('u1', controller);
	});

	it('serverless publishes and does NOT also enqueue locally', async () => {
		setPlatform(false);
		const { frames, controller } = fakeController();
		registerStream('u2', controller);

		expect(usesPubSub()).toBe(true);
		await notifyUser('u2', { type: 'new' });

		// The local stream is itself a subscriber — enqueuing here too would
		// double-fire the event for a same-instance listener.
		expect(frames).toEqual([]);
		expect(redisMock.publish).toHaveBeenCalledWith('notif:stream:u2', { type: 'new' });
		unregisterStream('u2', controller);
	});

	it('serverless without Redis configured falls back to local', async () => {
		setPlatform(false);
		redisValue = null;
		const { frames, controller } = fakeController();
		registerStream('u3', controller);

		expect(usesPubSub()).toBe(false);
		await notifyUser('u3', { type: 'new' });

		expect(frames).toHaveLength(1);
		unregisterStream('u3', controller);
	});

	it('a publish failure degrades to local instead of throwing', async () => {
		setPlatform(false);
		redisMock.publish.mockRejectedValue(new Error('upstash down'));
		const { frames, controller } = fakeController();
		registerStream('u4', controller);

		await expect(notifyUser('u4', { type: 'new' })).resolves.toBeUndefined();
		expect(frames).toHaveLength(1);
		unregisterStream('u4', controller);
	});
});

describe('subscribeUser', () => {
	it('is a no-op on a persistent host', () => {
		expect(subscribeUser('u5', () => {})).toBeNull();
		expect(redisMock.subscribe).not.toHaveBeenCalled();
	});

	it('subscribes to the user channel and forwards messages', () => {
		setPlatform(false);
		const listeners: Record<string, (e: unknown) => void> = {};
		const sub = {
			on: vi.fn((type: string, fn: (e: unknown) => void) => {
				listeners[type] = fn;
			}),
			removeAllListeners: vi.fn(),
			unsubscribe: vi.fn().mockResolvedValue(undefined),
		};
		redisMock.subscribe.mockReturnValue(sub);

		const seen: Record<string, unknown>[] = [];
		const off = subscribeUser('u6', (d) => seen.push(d));

		expect(redisMock.subscribe).toHaveBeenCalledWith(['notif:stream:u6']);
		listeners.message?.({ channel: 'notif:stream:u6', message: { type: 'new' } });
		expect(seen).toEqual([{ type: 'new' }]);

		off?.();
		expect(sub.removeAllListeners).toHaveBeenCalled();
		expect(sub.unsubscribe).toHaveBeenCalled();
	});

	it('a throwing handler does not escape the subscriber', () => {
		setPlatform(false);
		const listeners: Record<string, (e: unknown) => void> = {};
		redisMock.subscribe.mockReturnValue({
			on: vi.fn((type: string, fn: (e: unknown) => void) => {
				listeners[type] = fn;
			}),
			removeAllListeners: vi.fn(),
			unsubscribe: vi.fn().mockResolvedValue(undefined),
		});

		subscribeUser('u7', () => {
			throw new Error('controller closed');
		});
		expect(() => listeners.message?.({ channel: 'c', message: {} })).not.toThrow();
	});
});

describe('registerStream', () => {
	it('caps concurrent streams per user', () => {
		const controllers = Array.from({ length: SSE_MAX_PER_USER }, () => fakeController().controller);
		for (const c of controllers) expect(registerStream('u8', c)).toBe(true);
		expect(registerStream('u8', fakeController().controller)).toBe(false);
		for (const c of controllers) unregisterStream('u8', c);
		// Slot freed once the set empties.
		expect(registerStream('u8', fakeController().controller)).toBe(true);
	});

	it('enqueueLocal on an unknown user is a no-op', () => {
		expect(() => enqueueLocal('nobody', encodeEvent({ type: 'new' }))).not.toThrow();
	});
});
