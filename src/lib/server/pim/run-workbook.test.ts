import { describe, expect, it } from 'vitest';
import { shopTarget, supplierRecipe, supplierSheet } from './fixtures/supplier-fixture';
import { runWorkbookSheets } from './run-workbook';
import { readWorkbookTable, writeWorkbook } from './sheet-workbook';
import { checkSheet } from './target-schema';
import { applyRecipe } from './transform-recipe';

describe('runWorkbookSheets', () => {
	const recipe = supplierRecipe();
	const run = applyRecipe(supplierSheet(), recipe);
	const sheets = runWorkbookSheets({ recipe, run, check: checkSheet(run.sheet, shopTarget()) });

	it('puts the output first, then issues, changes and the recipe', () => {
		expect(sheets.map((s) => s.name)).toEqual(['products', 'issues', 'changes', 'recipe']);
		expect(sheets[1].table.slice(1)).toEqual([
			['7', 'gtin', 'kind', '4.01235E+12'],
			['7', 'weight', 'kind', 'ca. 2kg'],
			['7', 'brand', 'required', ''],
		]);
		expect(sheets[3].table[9]).toEqual(['9', 'Normalize GTINs in "gtin"', '4', '7: 4.01235E+12', '']);
	});

	it('survives the trip through an .xlsx file', async () => {
		const bytes = await writeWorkbook(sheets);
		const products = await readWorkbookTable(bytes.buffer as ArrayBuffer, 'products');
		expect(products).toEqual(sheets[0].table);
		expect(products[1][1]).toBe('0012345678905');
	});
});
