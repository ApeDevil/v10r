import { describe, expect, it } from 'vitest';
import { capabilitiesFor } from './model-capabilities';

describe('capabilitiesFor', () => {
	it('keeps the flags the hardcoded registry carried for the known defaults', () => {
		expect(capabilitiesFor('groq', 'llama-3.3-70b-versatile')).toEqual({
			tools: true,
			vision: false,
			recognized: true,
		});
		expect(capabilitiesFor('openai', 'gpt-4o-mini')).toEqual({ tools: true, vision: true, recognized: true });
		expect(capabilitiesFor('google', 'gemini-2.5-flash')).toEqual({ tools: true, vision: true, recognized: true });
	});

	it('knows the suggested Groq replacement is text-only', () => {
		expect(capabilitiesFor('groq', 'openai/gpt-oss-120b')).toEqual({ tools: true, vision: false, recognized: true });
	});

	it('treats an unrecognized id as text-only rather than trusting the vendor', () => {
		expect(capabilitiesFor('openai', 'some-future-text-model')).toEqual({
			tools: false,
			vision: false,
			recognized: false,
		});
		expect(capabilitiesFor('google', 'gemma-3-27b')).toEqual({ tools: false, vision: false, recognized: false });
	});

	it('does not let a family leak across vendors', () => {
		expect(capabilitiesFor('groq', 'gpt-4o-mini').recognized).toBe(false);
		expect(capabilitiesFor('openai', 'gemini-2.5-flash').recognized).toBe(false);
	});
});
