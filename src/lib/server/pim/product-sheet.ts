/**
 * A product sheet: a supplier's or ERP's tabular product export, held as text.
 *
 * Every value is a string, on purpose. Product data is full of digit strings that are not
 * numbers — a GTIN `0012345678905`, an article number `1E5`, a size `08` — and the classic
 * spreadsheet corruption is a reader that coerces them (leading zero gone, `1E5` read as
 * 100000). The sheet keeps the text a person typed; an op that means to normalize says so
 * in the recipe, where it can be reviewed.
 *
 * Every row keeps its source `line` — the row number a person sees in Excel — so an issue,
 * a change or a removed duplicate can always be pointed at in the file it came from.
 */
import { ProductDataError } from './errors';

export interface ProductRow {
	/** 1-based row number in the source file. */
	line: number;
	/** Column name → cell text; every sheet column is present, an empty cell is `''`. */
	values: Record<string, string>;
}

export interface ProductSheet {
	/** Header names in source order. Unique and non-empty. */
	columns: string[];
	rows: ProductRow[];
}

/**
 * Read a table (first row = header) into a sheet. A column with no header and no values is
 * dropped as layout; a column with values but no header, or a repeated header, is refused —
 * there is no honest name to give its cells, and guessing one would put data under a
 * column nobody asked for.
 */
export function productSheetFromTable(table: string[][]): ProductSheet {
	const [header, ...body] = table;
	if (!header) throw new ProductDataError('unreadable_sheet', 'The sheet is empty: no header row.');

	const width = Math.max(header.length, ...body.map((r) => r.length));
	const kept: { index: number; name: string }[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < width; index++) {
		const name = (header[index] ?? '').trim();
		if (name === '') {
			if (body.some((r) => (r[index] ?? '').trim() !== '')) {
				throw new ProductDataError('unreadable_sheet', `Column ${index + 1} holds values but has no header.`);
			}
			continue;
		}
		if (seen.has(name)) throw new ProductDataError('unreadable_sheet', `The header "${name}" appears twice.`);
		seen.add(name);
		kept.push({ index, name });
	}
	if (kept.length === 0) throw new ProductDataError('unreadable_sheet', 'The header row names no columns.');

	const rows: ProductRow[] = [];
	body.forEach((cells, i) => {
		if (cells.every((c) => (c ?? '').trim() === '')) return;
		const values: Record<string, string> = {};
		for (const { index, name } of kept) values[name] = cells[index] ?? '';
		rows.push({ line: i + 2, values });
	});
	return { columns: kept.map((c) => c.name), rows };
}

/** The sheet as a table again — header first, rows in order — for writing back out. */
export function productSheetToTable(sheet: ProductSheet): string[][] {
	return [sheet.columns, ...sheet.rows.map((r) => sheet.columns.map((c) => r.values[c] ?? ''))];
}
