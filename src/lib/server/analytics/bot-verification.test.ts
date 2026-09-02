import { describe, expect, it } from 'vitest';
import type { BotIdentity } from './bot-classify';
import { type PublishedPrefixes, verifyBotIdentity } from './bot-verification';

const gptbot: BotIdentity = { family: 'gptbot', category: 'ai_training', rangeSource: 'openai' };
const ccbot: BotIdentity = { family: 'ccbot', category: 'ai_training', rangeSource: null };

const ranges =
	(prefixes: readonly string[] | null): PublishedPrefixes =>
	async () =>
		prefixes;

describe('verifyBotIdentity', () => {
	it('is unpublished for an operator without a feed, and never consults the ranges', async () => {
		let asked = false;
		const spy: PublishedPrefixes = async () => {
			asked = true;
			return ['0.0.0.0/0'];
		};
		expect(await verifyBotIdentity(ccbot, '1.2.3.4', spy)).toBe('unpublished');
		expect(asked).toBe(false);
	});

	it('is unchecked without a usable source address', async () => {
		expect(await verifyBotIdentity(gptbot, null, ranges(['1.2.3.0/24']))).toBe('unchecked');
		expect(await verifyBotIdentity(gptbot, 'garbage', ranges(['1.2.3.0/24']))).toBe('unchecked');
	});

	it('is unchecked when the feed was never published or came back empty — not spoofed', async () => {
		expect(await verifyBotIdentity(gptbot, '1.2.3.4', ranges(null))).toBe('unchecked');
		expect(await verifyBotIdentity(gptbot, '1.2.3.4', ranges([]))).toBe('unchecked');
	});

	it('verifies a hit from inside the published range and flags one from outside', async () => {
		expect(await verifyBotIdentity(gptbot, '20.171.207.9', ranges(['20.171.207.0/24']))).toBe('verified');
		expect(await verifyBotIdentity(gptbot, '20.171.208.9', ranges(['20.171.207.0/24']))).toBe('spoofed');
	});

	it('unwraps an IPv4-mapped IPv6 source before comparing', async () => {
		expect(await verifyBotIdentity(gptbot, '::ffff:20.171.207.9', ranges(['20.171.207.0/24']))).toBe('verified');
	});
});
