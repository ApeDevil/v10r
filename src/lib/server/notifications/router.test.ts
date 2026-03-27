import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db/notifications/mutations', () => ({
	getOrCreateSettings: vi.fn(),
}));

const { getOrCreateSettings } = await import('$lib/server/db/notifications/mutations');
const { routeToChannels } = await import('./router');

const mockSettings = getOrCreateSettings as ReturnType<typeof vi.fn>;

describe('routeToChannels', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns ["email"] for security type (always forced)', async () => {
		mockSettings.mockResolvedValue({
			emailSecurity: false, // even when explicitly off, security forces email
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'security');
		expect(channels).toContain('email');
	});

	it('respects email setting per type', async () => {
		mockSettings.mockResolvedValue({
			emailMention: true,
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'mention');
		expect(channels).toContain('email');
	});

	it('excludes email when setting is false', async () => {
		mockSettings.mockResolvedValue({
			emailComment: false,
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'comment');
		expect(channels).not.toContain('email');
	});

	it('returns [] when globally muted (mutedUntil in future)', async () => {
		mockSettings.mockResolvedValue({
			emailMention: true,
			mutedUntil: new Date(Date.now() + 60_000),
		});

		const channels = await routeToChannels('user-1', 'mention');
		expect(channels).toEqual([]);
	});

	it('returns [] when settings is null', async () => {
		mockSettings.mockResolvedValue(null);

		const channels = await routeToChannels('user-1', 'mention');
		expect(channels).toEqual([]);
	});

	it('includes telegram when telegram setting is true', async () => {
		mockSettings.mockResolvedValue({
			emailMention: false,
			telegramMention: true,
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'mention');
		expect(channels).toContain('telegram');
	});
});
