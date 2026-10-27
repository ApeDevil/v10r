import { describe, expect, it } from 'vitest';
import { supplierSheet } from './fixtures/supplier-fixture';
import type { ProductSheet } from './product-sheet';
import { PROFILE_VALUE_LENGTH, profileSheet } from './sheet-profile';

describe('profileSheet', () => {
	const profile = profileSheet(supplierSheet());
	const column = (name: string) => profile.columns.find((c) => c.name === name);

	it('describes each column by fill, distinct values and shape', () => {
		expect(profile.rows).toBe(10);
		expect(column('Hersteller')).toMatchObject({ filled: 9, empty: 1 });
		expect(column('Gewicht')?.shape).toBe('mixed');
		expect(column('Farbe')?.topValues[0]).toEqual({ value: 'schwarz', count: 3 });
	});

	it('is bounded by columns, not rows — the agent reads the same size for any export', () => {
		const wide = (rows: number): ProductSheet => ({
			columns: ['sku', 'title'],
			rows: Array.from({ length: rows }, (_, i) => ({
				line: i + 2,
				values: { sku: `A-${i}`, title: `${'long title '.repeat(20)}${i}` },
			})),
		});
		const small = JSON.stringify(profileSheet(wide(20))).length;
		const large = JSON.stringify(profileSheet(wide(20_000))).length;
		expect(large).toBeLessThan(small * 1.1);
		expect(profileSheet(wide(3)).sample[0].values.title.length).toBeLessThanOrEqual(PROFILE_VALUE_LENGTH);
	});
});
