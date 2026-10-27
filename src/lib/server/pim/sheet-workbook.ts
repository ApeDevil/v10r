/**
 * Excel (.xlsx) in and out, as tables of text.
 *
 * Reading keeps numbers as the digits stored in the file (`parseNumber` returns the string),
 * so a GTIN or article number is never routed through a float. Excel may already have damaged
 * a value before the file reached us — leading zeros typed into a number cell are not in the
 * file at all — and that is a recipe's job to repair, visibly (`normalize_gtin`).
 *
 * Writing stores every cell as text for the same reason: a value written as a number is
 * re-coerced the next time someone opens and saves the file.
 */
import { readSheet } from 'read-excel-file/universal';
import writeExcelFile from 'write-excel-file/universal';

/** One worksheet to write: its tab name and its rows, header first. */
export interface WorkbookSheet {
	name: string;
	table: string[][];
}

function cellText(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) {
		const iso = value.toISOString();
		return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
	}
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
	return String(value);
}

/** The worksheet `sheet` (1-based index or tab name; default the first) as a table of text. */
export async function readWorkbookTable(bytes: ArrayBuffer, sheet: number | string = 1): Promise<string[][]> {
	const data = await readSheet<string>(bytes, sheet, { trim: false, parseNumber: (digits) => digits });
	return data.map((row) => row.map(cellText));
}

/** An .xlsx file holding `sheets` in order, every cell written as text. */
export async function writeWorkbook(sheets: WorkbookSheet[]): Promise<Uint8Array> {
	const blob = await writeExcelFile(
		sheets.map((s) => ({
			sheet: s.name,
			stickyRowsCount: 1,
			data: s.table.map((row, r) =>
				row.map((value) => ({ value, type: String, fontWeight: r === 0 ? ('bold' as const) : undefined })),
			),
		})),
	).toBlob();
	return new Uint8Array(await blob.arrayBuffer());
}
