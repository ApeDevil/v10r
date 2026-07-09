import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateNotification = vi.fn();
const mockNotifyUser = vi.fn();
const mockRouteToChannels = vi.fn();
const mockCreateDeliveries = vi.fn();
const mockProviderSend = vi.fn();

vi.mock('$lib/server/db/notifications/mutations', () => ({
	createNotification: mockCreateNotification,
}));

vi.mock('./stream', () => ({
	notifyUser: mockNotifyUser,
}));

vi.mock('./router', () => ({
	routeToChannels: mockRouteToChannels,
}));

vi.mock('./outbox', () => ({
	createDeliveries: mockCreateDeliveries,
}));

vi.mock('./providers', () => ({
	getProvider: vi.fn(() => ({ send: mockProviderSend })),
}));

vi.mock('./render-message', () => ({
	renderNotification: vi.fn((key: string) => `rendered:${key}`),
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => [{ email: 'test@example.com', locale: 'de' }]),
				})),
			})),
		})),
	},
}));

// Partial mock: the schema modules imported by service.ts need the real
// pg-core column builders — only stub what the test controls.
vi.mock('drizzle-orm', async (importOriginal) => {
	const actual = await importOriginal<typeof import('drizzle-orm')>();
	return { ...actual, eq: vi.fn() };
});

vi.mock('$lib/server/db/schema/auth/_better-auth', () => ({
	user: { id: 'id', email: 'email' },
}));

vi.mock('$lib/server/db/schema/app/user-preferences', () => ({
	userPreferences: { userId: 'userId', locale: 'locale' },
}));

const { NotificationService } = await import('./service');

/** routeExternal is fire-and-forget — let its microtasks settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('NotificationService', () => {
	const input = {
		userId: 'user-1',
		type: 'mention' as const,
		messageKey: 'notif_mention',
		messageParams: {},
	};

	const fakeNotification = {
		id: 'notif-1',
		userId: 'user-1',
		type: 'mention',
		messageKey: 'notif_mention',
		messageParams: {},
		actionUrl: null,
		createdAt: new Date(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateNotification.mockResolvedValue(fakeNotification);
		mockRouteToChannels.mockResolvedValue([]);
		mockCreateDeliveries.mockResolvedValue([]);
		mockProviderSend.mockResolvedValue({ success: true });
	});

	it('calls createNotification with input', async () => {
		await NotificationService.send(input);
		expect(mockCreateNotification).toHaveBeenCalledWith(input);
	});

	it('calls notifyUser with SSE payload', async () => {
		await NotificationService.send(input);
		expect(mockNotifyUser).toHaveBeenCalledWith('user-1', {
			type: 'new',
			notification: expect.objectContaining({
				id: 'notif-1',
				type: 'mention',
				messageKey: 'notif_mention',
			}),
		});
	});

	it('returns the created notification', async () => {
		const result = await NotificationService.send(input);
		expect(result).toBe(fakeNotification);
	});

	it('external routing failure does not throw', async () => {
		mockRouteToChannels.mockRejectedValue(new Error('routing boom'));

		// send() itself should not throw — routing is async/caught
		const result = await NotificationService.send(input);
		expect(result).toBe(fakeNotification);
	});

	it('partitions push OUT of the outbox and sends it synchronously', async () => {
		mockRouteToChannels.mockResolvedValue(['email', 'push']);

		await NotificationService.send(input);
		await flush();

		// Outbox gets only the durable channels — push must never become a pending row.
		expect(mockCreateDeliveries).toHaveBeenCalledWith('notif-1', ['email']);
		// Push goes straight to the provider with the no-PII contract.
		expect(mockProviderSend).toHaveBeenCalledWith({
			to: 'user-1',
			subject: expect.any(String),
			body: 'rendered:notif_push_mention',
			navigate: '/account/notifications?n=notif-1',
			lang: 'de',
		});
	});

	it('push-only routing skips the outbox entirely', async () => {
		mockRouteToChannels.mockResolvedValue(['push']);

		await NotificationService.send(input);
		await flush();

		expect(mockCreateDeliveries).not.toHaveBeenCalled();
		expect(mockProviderSend).toHaveBeenCalled();
	});
});
