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

	it('includes push when the push setting is true', async () => {
		mockSettings.mockResolvedValue({
			emailMention: false,
			pushMention: true,
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'mention');
		expect(channels).toContain('push');
	});

	it('excludes push when the push setting is false', async () => {
		mockSettings.mockResolvedValue({
			emailSecurity: true,
			pushSecurity: false,
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'security');
		expect(channels).not.toContain('push');
	});

	it('never routes push for types without a push column (success/follow)', async () => {
		mockSettings.mockResolvedValue({
			emailSuccess: true,
			mutedUntil: null,
		});

		const channels = await routeToChannels('user-1', 'success');
		expect(channels).not.toContain('push');
	});

	describe('digestFrequency: never', () => {
		it('suppresses every external channel', async () => {
			mockSettings.mockResolvedValue({
				emailMention: true,
				pushMention: true,
				mutedUntil: null,
				digestFrequency: 'never',
			});

			expect(await routeToChannels('user-1', 'mention')).toEqual([]);
		});

		it('does not suppress security', async () => {
			mockSettings.mockResolvedValue({
				emailSecurity: true,
				mutedUntil: null,
				digestFrequency: 'never',
			});

			expect(await routeToChannels('user-1', 'security')).toContain('email');
		});

		it('any other value routes normally', async () => {
			mockSettings.mockResolvedValue({
				emailMention: true,
				mutedUntil: null,
				digestFrequency: 'instant',
			});

			expect(await routeToChannels('user-1', 'mention')).toContain('email');
		});
	});

	describe('mutedUntil vs security', () => {
		// Before this change `mutedUntil` was checked BEFORE the security
		// force-send, so a global mute suppressed security alerts while an
		// explicit `emailSecurity: false` did not. The two mutes disagreed about
		// the one category that matters most; security now always wins.
		it('an active global mute does NOT suppress a security alert', async () => {
			mockSettings.mockResolvedValue({
				emailSecurity: false,
				mutedUntil: new Date(Date.now() + 60_000),
			});

			expect(await routeToChannels('user-1', 'security')).toContain('email');
		});

		it('an active global mute still suppresses everything else', async () => {
			mockSettings.mockResolvedValue({
				emailMention: true,
				mutedUntil: new Date(Date.now() + 60_000),
			});

			expect(await routeToChannels('user-1', 'mention')).toEqual([]);
		});
	});
});
