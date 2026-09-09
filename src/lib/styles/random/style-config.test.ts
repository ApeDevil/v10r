/**
 * `StyleConfig` plumbing: the patch merge and the token → CSS-variable mapping.
 *
 * Two small, closely-coupled pure surfaces — `token-vars.ts` already imports its
 * allowlist from `palette-sanitize.ts`, and both are steps of the same custom-palette
 * pipeline. `palette-sanitize.test.ts` deliberately stays its own file: it is the XSS
 * boundary between a visitor-chosen value and an SSR <style> block, and a reviewer
 * should be able to find it by name.
 */
import { describe, expect, it } from 'vitest';
import { mergeStyleConfig } from './merge';
import { VALID_TOKEN_KEYS } from './palette-sanitize';
import { tokenToCssVar } from './token-vars';
import type { StyleConfig } from './types';

const base: StyleConfig = { paletteId: 'P1', typographyId: 'T1', radiusId: 'R2' } as StyleConfig;

describe('mergeStyleConfig', () => {
	it('replaces only the named dimension', () => {
		expect(mergeStyleConfig(base, { typographyId: 'T2' } as never)).toEqual({
			paletteId: 'P1',
			typographyId: 'T2',
			radiusId: 'R2',
		});
	});

	it('applies several dimensions at once', () => {
		expect(mergeStyleConfig(base, { paletteId: 'P3', radiusId: 'R1' } as never)).toEqual({
			paletteId: 'P3',
			typographyId: 'T1',
			radiusId: 'R1',
		});
	});

	it('is a no-op for an empty patch', () => {
		expect(mergeStyleConfig(base, {})).toEqual(base);
	});

	// A plain `{ ...base, ...patch }` would write `paletteId: undefined` here and
	// blank the visitor's palette. The explicit `??` per field is what prevents it.
	it('does not blank a dimension whose key is present but undefined', () => {
		expect(mergeStyleConfig(base, { paletteId: undefined, radiusId: undefined })).toEqual(base);
	});

	it('carries a custom palette id through untouched', () => {
		const merged = mergeStyleConfig(base, { paletteId: 'CP_a8f3e1b2c4d9' });
		expect(merged.paletteId).toBe('CP_a8f3e1b2c4d9');
		expect(merged.typographyId).toBe('T1');
	});

	it('returns a fresh object rather than mutating the base', () => {
		const merged = mergeStyleConfig(base, { paletteId: 'P4' });
		expect(merged).not.toBe(base);
		expect(base.paletteId).toBe('P1');
	});
});

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
