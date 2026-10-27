import { describe, expect, it } from 'vitest';
import { ProductDataError } from './errors';
import { productSheetFromTable, productSheetToTable } from './product-sheet';

describe('productSheetFromTable', () => {
	it('keeps source line numbers and skips blank rows', () => {
		const sheet = productSheetFromTable([['sku', 'gtin'], ['A-1', '0012345678905'], ['', ' '], ['A-2']]);
		expect(sheet.columns).toEqual(['sku', 'gtin']);
		expect(sheet.rows).toEqual([
			{ line: 2, values: { sku: 'A-1', gtin: '0012345678905' } },
			{ line: 4, values: { sku: 'A-2', gtin: '' } },
		]);
	});

	it('drops a nameless empty column but refuses one that holds values', () => {
		expect(
			productSheetFromTable([
				['sku', '', 'gtin'],
				['A-1', '', '1'],
			]).columns,
		).toEqual(['sku', 'gtin']);
		expect(() =>
			productSheetFromTable([
				['sku', ''],
				['A-1', 'x'],
			]),
		).toThrow(ProductDataError);
	});

	it('refuses a repeated header and a sheet with no header', () => {
		expect(() => productSheetFromTable([['sku', 'sku']])).toThrow(/appears twice/);
		expect(() => productSheetFromTable([])).toThrow(/no header/);
	});

	it('writes back to the same table', () => {
		const table = [
			['sku', 'gtin'],
			['A-1', '0012345678905'],
		];
		expect(productSheetToTable(productSheetFromTable(table))).toEqual(table);
	});
});
