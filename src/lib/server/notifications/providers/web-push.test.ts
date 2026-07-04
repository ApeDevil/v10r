import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
	default: { sendNotification: vi.fn() },
}));

vi.mock('$lib/server/db/notifications/queries', () => ({
	getPushSubscriptions: vi.fn(),
}));

vi.mock('$lib/server/db/notifications/mutations', () => ({
	deletePushSubscriptionByEndpoint: vi.fn().mockResolvedValue(undefined),
	touchPushSubscription: vi.fn().mockResolvedValue(undefined),
}));

const webpush = (await import('web-push')).default;
const { getPushSubscriptions } = await import('$lib/server/db/notifications/queries');
const { deletePushSubscriptionByEndpoint } = await import('$lib/server/db/notifications/mutations');
const { WebPushProvider } = await import('./web-push');

const mockSend = webpush.sendNotification as ReturnType<typeof vi.fn>;
const mockSubscriptions = getPushSubscriptions as ReturnType<typeof vi.fn>;
const mockPrune = deletePushSubscriptionByEndpoint as ReturnType<typeof vi.fn>;

const sub = (endpoint: string) => ({
	id: endpoint,
	userId: 'user-1',
	endpoint,
	p256dh: 'p256dh-key',
	auth: 'auth-key',
	userAgent: null,
	createdAt: new Date(),
	lastUsedAt: null,
});

function pushError(statusCode: number) {
	const err = new Error(`push failed ${statusCode}`) as Error & { statusCode: number };
	err.statusCode = statusCode;
	return err;
}

describe('WebPushProvider', () => {
	const provider = new WebPushProvider();

	beforeEach(() => {
		vi.clearAllMocks();
		// vitest.setup.ts proxies $env/dynamic/private to process.env
		process.env.VAPID_PUBLIC_KEY = 'test-public';
		process.env.VAPID_PRIVATE_KEY = 'test-private';
		process.env.VAPID_SUBJECT = 'mailto:test@example.com';
	});

	it('fans out to every subscription of the user', async () => {
		mockSubscriptions.mockResolvedValue([sub('https://push.example/a'), sub('https://push.example/b')]);
		mockSend.mockResolvedValue({ statusCode: 201 });

		const result = await provider.send({ to: 'user-1', subject: 'v10r', body: 'System notification' });

		expect(mockSend).toHaveBeenCalledTimes(2);
		expect(result.success).toBe(true);
		expect(result.providerMessageId).toBe('2/2 devices');
	});

	it('sends the declarative-web-push JSON shape with NO content beyond the generic line', async () => {
		mockSubscriptions.mockResolvedValue([sub('https://push.example/a')]);
		mockSend.mockResolvedValue({ statusCode: 201 });

		await provider.send({
			to: 'user-1',
			subject: 'v10r',
			body: 'Someone mentioned you',
			navigate: '/app/notifications?n=abc',
			lang: 'de',
		});

		const payload = JSON.parse(mockSend.mock.calls[0][1] as string);
		expect(payload.web_push).toBe(8030);
		expect(payload.notification).toEqual({
			title: 'v10r',
			body: 'Someone mentioned you',
			navigate: '/app/notifications?n=abc',
			lang: 'de',
		});
		// Payload contract: exactly these keys — no ids-as-secrets, no user content fields.
		expect(Object.keys(payload.notification).sort()).toEqual(['body', 'lang', 'navigate', 'title']);
	});

	it('prunes subscriptions the push service reports gone (410) and still succeeds for the rest', async () => {
		mockSubscriptions.mockResolvedValue([sub('https://push.example/dead'), sub('https://push.example/alive')]);
		mockSend.mockRejectedValueOnce(pushError(410)).mockResolvedValueOnce({ statusCode: 201 });

		const result = await provider.send({ to: 'user-1', subject: 'v10r', body: 'x' });

		expect(mockPrune).toHaveBeenCalledWith('https://push.example/dead');
		expect(result.success).toBe(true);
		expect(result.providerMessageId).toBe('1/2 devices');
	});

	it('reports ALL_PRUNED (not retryable) when every endpoint is dead', async () => {
		mockSubscriptions.mockResolvedValue([sub('https://push.example/dead')]);
		mockSend.mockRejectedValue(pushError(410));

		const result = await provider.send({ to: 'user-1', subject: 'v10r', body: 'x' });

		expect(result.success).toBe(false);
		expect(result.errorCode).toBe('ALL_PRUNED');
		expect(result.retryable).toBe(false);
	});

	it('marks 429/5xx failures retryable', async () => {
		mockSubscriptions.mockResolvedValue([sub('https://push.example/a')]);
		mockSend.mockRejectedValue(pushError(429));

		const result = await provider.send({ to: 'user-1', subject: 'v10r', body: 'x' });

		expect(result.success).toBe(false);
		expect(result.retryable).toBe(true);
	});

	it('fails cleanly with no subscriptions', async () => {
		mockSubscriptions.mockResolvedValue([]);

		const result = await provider.send({ to: 'user-1', subject: 'v10r', body: 'x' });

		expect(result.success).toBe(false);
		expect(result.errorCode).toBe('NO_SUBSCRIPTIONS');
		expect(mockSend).not.toHaveBeenCalled();
	});

	it('fails cleanly (not retryable) without VAPID configuration', async () => {
		delete process.env.VAPID_PUBLIC_KEY;

		const result = await provider.send({ to: 'user-1', subject: 'v10r', body: 'x' });

		expect(result.success).toBe(false);
		expect(result.errorCode).toBe('NO_VAPID_KEYS');
		expect(result.retryable).toBe(false);
	});
});
