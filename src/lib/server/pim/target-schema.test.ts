import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { shopTarget, supplierRecipe, supplierSheet } from './fixtures/supplier-fixture';
import { productSheetFromTable } from './product-sheet';
import { checkSheet, groupIssues, targetSchemaSchema } from './target-schema';
import { applyRecipe } from './transform-recipe';

describe('targetSchemaSchema', () => {
	it('refuses an enum without values, a measure without a unit, and a key that is not an attribute', () => {
		const attempt = (attributes: unknown[], key = 'sku') =>
			v.safeParse(targetSchemaSchema, { key, attributes }).success;
		expect(attempt([{ name: 'sku', kind: 'text' }])).toBe(true);
		expect(
			attempt([
				{ name: 'sku', kind: 'text' },
				{ name: 'color', kind: 'enum' },
			]),
		).toBe(false);
		expect(
			attempt([
				{ name: 'sku', kind: 'text' },
				{ name: 'weight', kind: 'measure' },
			]),
		).toBe(false);
		expect(attempt([{ name: 'sku', kind: 'text' }], 'id')).toBe(false);
	});
});

describe('checkSheet', () => {
	const target = shopTarget();

	it('reports a missing required column for every row', () => {
		const check = checkSheet(supplierSheet(), target);
		expect(check.missingColumns).toContain('sku');
		expect(check.extraColumns).toContain('Artikelnr');
		expect(check.rowsWithIssues).toBe(10);
	});

	it('checks every rule, row by row, with the source line', () => {
		const sheet = productSheetFromTable([
			['sku', 'gtin', 'title', 'color', 'weight', 'brand'],
			['A-1', '4006381333932', 'x'.repeat(81), 'Green', '850 g', 'B'],
			['A-1', '4006381333931', 'ok', 'Black', '0.85 kg', ''],
		]);
		const rules = checkSheet(sheet, target).issues.map((i) => `${i.line}:${i.column}:${i.rule}`);
		expect(rules).toEqual([
			'2:gtin:kind',
			'2:title:max_length',
			'2:color:enum',
			'2:weight:unit',
			'3:brand:required',
			'3:sku:duplicate_key',
		]);
	});

	it('after the worked recipe, only the rows that need a person remain', () => {
		const check = checkSheet(applyRecipe(supplierSheet(), supplierRecipe()).sheet, target);
		expect(check.missingColumns).toEqual([]);
		expect(check.extraColumns).toEqual([]);
		expect(check.issues).toEqual([
			{ line: 7, column: 'gtin', rule: 'kind', value: '4.01235E+12' },
			{ line: 7, column: 'weight', rule: 'kind', value: 'ca. 2kg' },
			{ line: 7, column: 'brand', rule: 'required', value: '' },
		]);
		expect(groupIssues(check)).toHaveLength(3);
	});
});
