import { describe, expect, it } from 'vitest';
import { estimateTurnTokens, fitsTokenMinute, PROVIDER_LIMITS } from './provider-limits';

describe('estimateTurnTokens', () => {
	it('charges the prompt once per step at 4 chars a token, rounded up', () => {
		expect(estimateTurnTokens(4_000, 1)).toBe(1_000);
		expect(estimateTurnTokens(4_000, 2)).toBe(2_000);
		expect(estimateTurnTokens(4_001, 1)).toBe(1_001);
	});
});

describe('fitsTokenMinute', () => {
	const groq = PROVIDER_LIMITS.groq;
	const [groqModel] = groq.verifiedModels;

	it('leaves out a verified model whose per-minute ceiling the turn exceeds', () => {
		expect(groq.tpm).not.toBeNull();
		expect(fitsTokenMinute('groq', groqModel, (groq.tpm as number) + 1)).toBe(false);
		expect(fitsTokenMinute('groq', groqModel, groq.tpm as number)).toBe(true);
	});

	it('never blocks on what it does not know: no entry, no ceiling, or an unverified model', () => {
		expect(fitsTokenMinute('mistral', 'anything', 1_000_000)).toBe(true);
		expect(fitsTokenMinute('groq', 'llama-3.1-8b-instant', 1_000_000)).toBe(true);
		expect(fitsTokenMinute('openai', PROVIDER_LIMITS.openai.verifiedModels[0], 1_000_000)).toBe(
			PROVIDER_LIMITS.openai.tpm === null ? true : PROVIDER_LIMITS.openai.tpm >= 1_000_000,
		);
	});
});
