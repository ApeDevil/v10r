import { describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/universal';
import { readWorkbookTable, writeWorkbook } from './sheet-workbook';

describe('xlsx round trip', () => {
	it('keeps digit strings as written: leading zeros, long GTINs, 1E5', async () => {
		const table = [
			['sku', 'gtin', 'size'],
			['1E5', '0012345678905', '08'],
		];
		const bytes = await writeWorkbook([{ name: 'products', table }]);
		expect(await readWorkbookTable(bytes.buffer as ArrayBuffer)).toEqual(table);
	});

	it('reads a numeric cell as its stored digits, not through a float', async () => {
		const blob = await writeExcelFile([['gtin'], [4006381333931]]).toBlob();
		expect(await readWorkbookTable(await blob.arrayBuffer())).toEqual([['gtin'], ['4006381333931']]);
	});

	it('writes several sheets and reads one by name', async () => {
		const bytes = await writeWorkbook([
			{ name: 'products', table: [['sku'], ['A-1']] },
			{ name: 'issues', table: [['line'], ['2']] },
		]);
		expect(await readWorkbookTable(bytes.buffer as ArrayBuffer, 'issues')).toEqual([['line'], ['2']]);
	});
});
