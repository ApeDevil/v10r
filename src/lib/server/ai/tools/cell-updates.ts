/**
 * The cell-write contract the desk AI tools share: a list of `{ cell, value }` pairs,
 * applied to a stored map. `desk_update_cells` merges into an existing sheet;
 * `desk_create_spreadsheet` applies to an empty one — in-loop and on approval replay
 * alike, so the three call sites cannot drift.
 */
import { type CellValue, cellLabel, parseCellRef } from '$lib/desk/formula';
import type { SpreadsheetCells } from '$lib/desk/spreadsheet-cells';

export interface CellUpdate {
	/** A cell address such as `A1` or `C10`; case is forgiven. */
	cell: string;
	/** Text, a number, a formula (`=SUM(B1:B3)`), or `null` to clear the cell. */
	value: CellValue;
}

/**
 * Apply the writes to a copy of `cells`. Addresses are canonicalised (`b2` → `B2`) so a
 * write lands on the cell it names rather than beside it; an address the grid cannot show
 * refuses the whole batch, because the model is told what was saved and must not be told
 * a lie. Values are stored as given — the mutation re-derives formulas on write.
 */
export function applyCellUpdates(
	cells: SpreadsheetCells,
	updates: CellUpdate[],
): { cells: SpreadsheetCells } | { error: string } {
	const next: SpreadsheetCells = { ...cells };
	for (const { cell, value } of updates) {
		const ref = typeof cell === 'string' ? parseCellRef(cell.toUpperCase()) : null;
		if (!ref) return { error: `"${cell}" is not a cell address — use a column A–Z and a row number, like B3.` };
		const label = cellLabel(ref.col, ref.row);
		if (value === null) delete next[label];
		else next[label] = { v: value };
	}
	return { cells: next };
}
