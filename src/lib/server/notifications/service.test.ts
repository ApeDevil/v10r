import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateNotification = vi.fn();
const mockNotifyUser = vi.fn();
const mockRouteToChannels = vi.fn();
const mockCreateDeliveries = vi.fn();

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

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => [{ email: 'test@example.com' }]),
				})),
			})),
		})),
	},
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
}));

vi.mock('$lib/server/db/schema/auth/_better-auth', () => ({
	user: { id: 'id', email: 'email' },
}));

const { NotificationService } = await import('./service');

describe('NotificationService', () => {
	const input = {
		userId: 'user-1',
		type: 'mention' as const,
		title: 'You were mentioned',
		body: 'In a discussion',
	};

	const fakeNotification = {
		id: 'notif-1',
		userId: 'user-1',
		type: 'mention',
		title: 'You were mentioned',
		body: 'In a discussion',
		actionUrl: null,
		createdAt: new Date(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateNotification.mockResolvedValue(fakeNotification);
		mockRouteToChannels.mockResolvedValue([]);
		mockCreateDeliveries.mockResolvedValue([]);
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
				title: 'You were mentioned',
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
});
