import { describe, expect, it } from 'vitest';
import { mergeStyleConfig } from './merge';
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
