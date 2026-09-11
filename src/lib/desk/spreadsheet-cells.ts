/**
 * The cell map `desk.spreadsheet.cells` stores, and the two rules that keep it honest.
 *
 * A stored value is an answer, not a fact: it is only right while the cells its formula
 * reads are unchanged. The grid re-derives every value when it loads a sheet; this module
 * lets a writer that has no grid — the AI tools — store a sheet the grid would agree with.
 */
import { type CellValue, cellLabel, createGridResolver, parseCellRef } from './formula';

/** One cell as the sheet stores it. */
export interface PersistedCell {
	/** The cell's value; for a formula, its last derived result. */
	v: CellValue;
	/** The formula text — present exactly when the cell is one. */
	f?: string;
	/** Format type; omitted for 'auto'. */
	t?: string;
}

/** Sparse and canonical: only populated cells, keyed by their `A1` label. */
export type SpreadsheetCells = Record<string, PersistedCell>;

/** What the author typed: the formula when there is one, otherwise the value as text. */
export function rawText(cell: PersistedCell): string {
	return cell.f ?? String(cell.v ?? '');
}

/** The stored form of a cell: a formula keeps its text in `f`; every cell keeps its derived value in `v`. */
export function persistedCell(raw: string, value: CellValue, t?: string): PersistedCell {
	const cell: PersistedCell = { v: value };
	if (raw.startsWith('=')) cell.f = raw;
	if (t !== undefined) cell.t = t;
	return cell;
}

/**
 * Re-derive every stored value in dependency order, so the map is internally consistent
 * whoever wrote it. Labels are canonicalised (`b2` → `B2`), a cell whose text is empty is
 * dropped, and a label the grid cannot address is refused rather than dropped — a writer
 * must never be told its edit was saved when no sheet can show it.
 */
export function recalculateCells(cells: SpreadsheetCells): SpreadsheetCells {
	const grid = new Map<string, { col: number; row: number; raw: string; t?: string }>();
	for (const [label, cell] of Object.entries(cells)) {
		const ref = parseCellRef(label.toUpperCase());
		if (!ref) throw new RangeError(`"${label}" is not a cell address`);
		const raw = rawText(cell).trim();
		if (raw === '') continue;
		grid.set(cellLabel(ref.col, ref.row), { ...ref, raw, t: cell.t });
	}

	const resolve = createGridResolver((col, row) => grid.get(cellLabel(col, row))?.raw);
	const result: SpreadsheetCells = {};
	for (const [label, { col, row, raw, t }] of grid) {
		result[label] = persistedCell(raw, resolve(col, row), t);
	}
	return result;
}
