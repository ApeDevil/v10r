/**
 * The manifest-derived meta maps: one entry per manifest tool of each surface, the scope
 * invariant (deskbot tools carry one, chatbot tools never), the risk lookup. What the
 * profiles mount from the same manifest is `profile/profile.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { TOOL_MANIFEST } from '$lib/types/ai-tools';
import { chatbotToolMeta, deskbotToolMeta } from './index';

describe('TOOL_MANIFEST ⇔ derived meta', () => {
	it("projects each surface's manifest entries, nothing else", () => {
		expect(Object.keys(chatbotToolMeta).sort()).toEqual(
			TOOL_MANIFEST.filter((d) => d.surface === 'chatbot')
				.map((d) => d.name)
				.sort(),
		);
		expect(Object.keys(deskbotToolMeta).sort()).toEqual(
			TOOL_MANIFEST.filter((d) => d.surface === 'deskbot')
				.map((d) => d.name)
				.sort(),
		);
	});

	it('deskbot meta carries a gating scope on every tool; chatbot meta carries none', () => {
		for (const meta of Object.values(deskbotToolMeta)) expect(meta.scope).toBeTruthy();
		for (const meta of Object.values(chatbotToolMeta)) expect('scope' in meta).toBe(false);
	});
});
