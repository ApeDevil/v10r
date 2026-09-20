import { describe, expect, it } from 'vitest';
import { channelsForSettings } from './router';

describe('channelsForSettings', () => {
	it('returns ["email"] for security type (always forced)', () => {
		const settings = {
			emailSecurity: false, // even when explicitly off, security forces email
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'security');
		expect(channels).toContain('email');
	});

	it('respects email setting per type', () => {
		const settings = {
			emailMention: true,
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'mention');
		expect(channels).toContain('email');
	});

	it('excludes email when setting is false', () => {
		const settings = {
			emailComment: false,
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'comment');
		expect(channels).not.toContain('email');
	});

	it('returns [] when globally muted (mutedUntil in future)', () => {
		const settings = {
			emailMention: true,
			mutedUntil: new Date(Date.now() + 60_000),
		};

		const channels = channelsForSettings(settings, 'mention');
		expect(channels).toEqual([]);
	});

	it('includes telegram when telegram setting is true', () => {
		const settings = {
			emailMention: false,
			telegramMention: true,
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'mention');
		expect(channels).toContain('telegram');
	});

	it('includes push when the push setting is true', () => {
		const settings = {
			emailMention: false,
			pushMention: true,
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'mention');
		expect(channels).toContain('push');
	});

	it('excludes push when the push setting is false', () => {
		const settings = {
			emailSecurity: true,
			pushSecurity: false,
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'security');
		expect(channels).not.toContain('push');
	});

	it('never routes push for types without a push column (success/follow)', () => {
		const settings = {
			emailSuccess: true,
			mutedUntil: null,
		};

		const channels = channelsForSettings(settings, 'success');
		expect(channels).not.toContain('push');
	});

	describe('digestFrequency: never', () => {
		it('suppresses every external channel', () => {
			const settings = {
				emailMention: true,
				pushMention: true,
				mutedUntil: null,
				digestFrequency: 'never',
			};

			expect(channelsForSettings(settings, 'mention')).toEqual([]);
		});

		it('does not suppress security', () => {
			const settings = {
				emailSecurity: true,
				mutedUntil: null,
				digestFrequency: 'never',
			};

			expect(channelsForSettings(settings, 'security')).toContain('email');
		});

		it('any other value routes normally', () => {
			const settings = {
				emailMention: true,
				mutedUntil: null,
				digestFrequency: 'instant',
			};

			expect(channelsForSettings(settings, 'mention')).toContain('email');
		});
	});

	describe('mutedUntil vs security', () => {
		// Before this change `mutedUntil` was checked BEFORE the security
		// force-send, so a global mute suppressed security alerts while an
		// explicit `emailSecurity: false` did not. The two mutes disagreed about
		// the one category that matters most; security now always wins.
		it('an active global mute does NOT suppress a security alert', () => {
			const settings = {
				emailSecurity: false,
				mutedUntil: new Date(Date.now() + 60_000),
			};

			expect(channelsForSettings(settings, 'security')).toContain('email');
		});

		it('an active global mute still suppresses everything else', () => {
			const settings = {
				emailMention: true,
				mutedUntil: new Date(Date.now() + 60_000),
			};

			expect(channelsForSettings(settings, 'mention')).toEqual([]);
		});
	});
});
