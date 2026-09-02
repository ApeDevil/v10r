import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateNotification = vi.fn();
// `notifyUser` is async now (it may be a Redis PUBLISH) and is awaited inside
// waitUntil — a bare vi.fn() returning undefined would throw on `.catch`.
const mockNotifyUser = vi.fn().mockResolvedValue(undefined);
// `routeExternal` now loads the settings row ONCE and passes it to the pure
// `channelsForSettings`, so the seam moved: the test controls the channel list
// through this mock and the quiet-hours window through `mockSettings`.
const mockChannelsForSettings = vi.fn();
const mockCreateDeliveries = vi.fn();
const mockChannelSend = vi.fn();

/** The settings row `getOrCreateSettings` returns. Quiet hours off by default. */
let mockSettings: Record<string, unknown> = { quietStart: null, quietEnd: null };

vi.mock('$lib/server/db/notifications/mutations', () => ({
	createNotification: mockCreateNotification,
	getOrCreateSettings: vi.fn(async () => mockSettings),
}));

vi.mock('./stream', () => ({
	notifyUser: mockNotifyUser,
}));

vi.mock('./router', () => ({
	channelsForSettings: mockChannelsForSettings,
}));

vi.mock('./outbox', () => ({
	createDeliveries: mockCreateDeliveries,
}));

vi.mock('./channels', () => ({
	getChannel: vi.fn(() => ({ send: mockChannelSend })),
}));

vi.mock('./render-message', () => ({
	renderNotification: vi.fn((key: string) => `rendered:${key}`),
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					// One shape for every select: the user row (email) and the
					// preferences row (locale + timeZone) are both read here.
					limit: vi.fn(() => [{ email: 'test@example.com', locale: 'de', timeZone: 'UTC' }]),
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

vi.mock('$lib/server/db/schema/personalization/user-preferences', () => ({
	userPreferences: { userId: 'userId', locale: 'locale', timezone: 'timezone' },
}));

const { sendNotification } = await import('./send');

/** routeExternal is fire-and-forget — let its microtasks settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('sendNotification', () => {
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
		mockSettings = { quietStart: null, quietEnd: null };
		mockCreateNotification.mockResolvedValue(fakeNotification);
		mockChannelsForSettings.mockReturnValue([]);
		mockCreateDeliveries.mockResolvedValue([]);
		mockChannelSend.mockResolvedValue({ success: true });
	});

	it('calls createNotification with input', async () => {
		await sendNotification(input);
		expect(mockCreateNotification).toHaveBeenCalledWith(input);
	});

	it('calls notifyUser with SSE payload', async () => {
		await sendNotification(input);
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
		const result = await sendNotification(input);
		expect(result).toBe(fakeNotification);
	});

	it('external routing failure does not throw', async () => {
		mockChannelsForSettings.mockImplementation(() => {
			throw new Error('routing boom');
		});

		// send() itself should not throw — routing is async/caught
		const result = await sendNotification(input);
		expect(result).toBe(fakeNotification);
	});

	it('partitions push OUT of the outbox and sends it synchronously', async () => {
		mockChannelsForSettings.mockReturnValue(['email', 'push']);

		await sendNotification(input);
		await flush();

		// Outbox gets only the durable channels — push must never become a pending row.
		expect(mockCreateDeliveries).toHaveBeenCalledWith('notif-1', ['email']);
		// Push goes straight to the channel with the no-PII contract.
		expect(mockChannelSend).toHaveBeenCalledWith({
			to: 'user-1',
			subject: expect.any(String),
			body: 'rendered:notif_push_mention',
			navigate: '/account/notifications?n=notif-1',
			lang: 'de',
		});
	});

	it('push-only routing skips the outbox entirely', async () => {
		mockChannelsForSettings.mockReturnValue(['push']);

		await sendNotification(input);
		await flush();

		expect(mockCreateDeliveries).not.toHaveBeenCalled();
		expect(mockChannelSend).toHaveBeenCalled();
	});

	describe('quiet hours', () => {
		// The db mock returns a fixed row for every select, so `timezone` resolves
		// to the string 'UTC' below via the shared fixture.
		it('suppresses BOTH the outbox and push inside the window', async () => {
			mockChannelsForSettings.mockReturnValue(['email', 'push']);
			mockSettings = { quietStart: '00:00', quietEnd: '23:59' };

			await sendNotification(input);
			await flush();

			// Push bypasses the outbox entirely, so a check placed in the outbox
			// path alone would leave the 3am lock-screen buzz — the whole point.
			expect(mockCreateDeliveries).not.toHaveBeenCalled();
			expect(mockChannelSend).not.toHaveBeenCalled();
		});

		it('still delivers the in-app notification and its live frame', async () => {
			mockChannelsForSettings.mockReturnValue(['email']);
			mockSettings = { quietStart: '00:00', quietEnd: '23:59' };

			await sendNotification(input);
			await flush();

			expect(mockNotifyUser).toHaveBeenCalled();
			expect(mockCreateDeliveries).not.toHaveBeenCalled();
		});

		it('security alerts are exempt', async () => {
			mockChannelsForSettings.mockReturnValue(['email']);
			mockSettings = { quietStart: '00:00', quietEnd: '23:59' };

			await sendNotification({ ...input, type: 'security' });
			await flush();

			expect(mockCreateDeliveries).toHaveBeenCalledWith('notif-1', ['email']);
		});

		it('delivers normally outside the window', async () => {
			mockChannelsForSettings.mockReturnValue(['email']);
			mockSettings = { quietStart: null, quietEnd: null };

			await sendNotification(input);
			await flush();

			expect(mockCreateDeliveries).toHaveBeenCalledWith('notif-1', ['email']);
		});
	});
});
