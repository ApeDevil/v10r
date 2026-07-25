import { describe, expect, it } from 'vitest';
import { VALID_TOKEN_KEYS } from './palette-sanitize';
import { tokenToCssVar } from './token-vars';

describe('tokenToCssVar', () => {
	it('maps surface tokens to bare --surface-N', () => {
		expect(tokenToCssVar('surface-1')).toBe('--surface-1');
		expect(tokenToCssVar('surface-3')).toBe('--surface-3');
	});

	it('maps every other token under the --color- namespace', () => {
		expect(tokenToCssVar('bg')).toBe('--color-bg');
		expect(tokenToCssVar('primary-hover')).toBe('--color-primary-hover');
		expect(tokenToCssVar('on-accent-container')).toBe('--color-on-accent-container');
	});

	// This mapping is shared with the SSR <style> injector in hooks.server.ts. If
	// the two ever diverge, the live preview stops matching what the server
	// renders — silently, and only for custom palettes.
	it('produces a distinct, well-formed custom property for every allowlisted token', () => {
		const vars = [...VALID_TOKEN_KEYS].map(tokenToCssVar);
		expect(new Set(vars).size).toBe(VALID_TOKEN_KEYS.size);
		for (const name of vars) expect(name).toMatch(/^--[a-z0-9-]+$/);
	});
});
