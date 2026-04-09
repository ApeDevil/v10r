/**
 * Reactive spreadsheet state factory.
 *
 * Sparse storage: only non-empty cells occupy memory.
 * Formulas evaluated client-side via the formula evaluator.
 */

import {
	type CellGetter,
	type CellValue,
	cellLabel,
	colLabel,
	evaluateFormula,
	parseCellRef,
} from '$lib/utils/spreadsheet';

// ── Types ────────────────────────────────────────────────────────────

export interface SpreadsheetCell {
	/** What the user typed (may be a formula like "=SUM(A1:A3)") */
	raw: string;
	/** Evaluated result */
	value: CellValue;
	/** Error string if formula evaluation failed */
	error: string | null;
}

export interface SelectionRange {
	startCol: number;
	startRow: number;
	endCol: number;
	endRow: number;
}

export interface SelectionStats {
	sum: number;
	count: number;
	average: number;
}

/** Persisted cell format (matches JSONB schema) */
interface PersistedCell {
	v: string | number | null;
	f?: string;
	t?: string;
}

// ── Security: credential pattern scanner ─────────────────────────────

const SENSITIVE_PATTERNS = [
	/sk-[a-zA-Z0-9]{20,}/g,
	/ghp_[a-zA-Z0-9]{36}/g,
	/AKIA[A-Z0-9]{16}/g,
	/Bearer\s+[a-zA-Z0-9._-]+/gi,
	/postgres:\/\/[^\s]+/gi,
	/mysql:\/\/[^\s]+/gi,
	/mongodb(\+srv)?:\/\/[^\s]+/gi,
	/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
];

function redactSensitive(value: string): string {
	let result = value;
	for (const pattern of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, '[REDACTED]');
	}
	return result;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createSpreadsheetState(rowCount = 50, colCount = 26) {
	// Sparse storage: key = "col,row" (0-indexed)
	let cells = $state(new Map<string, SpreadsheetCell>());
	let activeCell = $state<{ col: number; row: number } | null>(null);
	let selectionRange = $state<SelectionRange | null>(null);
	let editing = $state(false);
	let editValue = $state('');
	let dirty = $state(0);

	// ── Cell key helpers ────────────────────────────────────────────

	function key(col: number, row: number): string {
		return `${col},${row}`;
	}

	// ── Cell access ─────────────────────────────────────────────────

	function getCell(col: number, row: number): SpreadsheetCell | undefined {
		return cells.get(key(col, row));
	}

	/** Get the evaluated value of a cell (used by formula engine) */
	const getCellValue: CellGetter = (col: number, row: number): CellValue => {
		const cell = cells.get(key(col, row));
		if (!cell) return null;
		if (cell.error) return cell.error;
		return cell.value;
	};

	function setCellRaw(col: number, row: number, raw: string): void {
		const trimmed = raw.trim();
		if (trimmed === '') {
			cells.delete(key(col, row));
		} else {
			const value = evaluateCell(trimmed, col, row);
			const error = typeof value === 'string' && value.startsWith('#') ? value : null;
			cells.set(key(col, row), { raw: trimmed, value, error });
		}
		// Recalculate all formula cells that might depend on this one
		recalculateAll();
		dirty++;
	}

	function evaluateCell(raw: string, col: number, row: number): CellValue {
		if (raw.startsWith('=')) {
			const visiting = new Set([cellLabel(col, row)]);
			return evaluateFormula(raw, getCellValue, visiting);
		}
		// Try number
		const num = Number(raw);
		if (!Number.isNaN(num) && raw !== '') return num;
		return raw;
	}

	/** Re-evaluate all formula cells */
	function recalculateAll(): void {
		for (const [k, cell] of cells) {
			if (cell.raw.startsWith('=')) {
				const [colStr, rowStr] = k.split(',');
				const col = parseInt(colStr, 10);
				const row = parseInt(rowStr, 10);
				const value = evaluateCell(cell.raw, col, row);
				const error = typeof value === 'string' && value.startsWith('#') ? value : null;
				cells.set(k, { ...cell, value, error });
			}
		}
	}

	// ── Selection ───────────────────────────────────────────────────

	function select(col: number, row: number, extend = false): void {
		if (extend && activeCell) {
			selectionRange = {
				startCol: activeCell.col,
				startRow: activeCell.row,
				endCol: col,
				endRow: row,
			};
		} else {
			activeCell = { col, row };
			selectionRange = null;
		}
		editing = false;
	}

	function startEditing(): void {
		if (!activeCell) return;
		const cell = getCell(activeCell.col, activeCell.row);
		editValue = cell?.raw ?? '';
		editing = true;
	}

	function commitEdit(): void {
		if (!activeCell || !editing) return;
		setCellRaw(activeCell.col, activeCell.row, editValue);
		editing = false;
	}

	function cancelEdit(): void {
		editing = false;
		editValue = '';
	}

	function moveSelection(dCol: number, dRow: number): void {
		if (!activeCell) {
			activeCell = { col: 0, row: 0 };
			return;
		}
		const newCol = Math.max(0, Math.min(colCount - 1, activeCell.col + dCol));
		const newRow = Math.max(0, Math.min(rowCount - 1, activeCell.row + dRow));
		activeCell = { col: newCol, row: newRow };
		selectionRange = null;
		editing = false;
	}

	/** Check if a cell is in the current selection range */
	function isInSelection(col: number, row: number): boolean {
		if (!selectionRange) return false;
		const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
		const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);
		const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
		const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);
		return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
	}

	function isActiveCell(col: number, row: number): boolean {
		return activeCell?.col === col && activeCell?.row === row;
	}

	// ── Selection stats ─────────────────────────────────────────────

	const selectionStats = $derived.by((): SelectionStats => {
		const range = selectionRange;
		const active = activeCell;
		if (!range && !active) return { sum: 0, count: 0, average: 0 };

		const nums: number[] = [];
		let count = 0;

		if (range) {
			const minCol = Math.min(range.startCol, range.endCol);
			const maxCol = Math.max(range.startCol, range.endCol);
			const minRow = Math.min(range.startRow, range.endRow);
			const maxRow = Math.max(range.startRow, range.endRow);

			for (let r = minRow; r <= maxRow; r++) {
				for (let c = minCol; c <= maxCol; c++) {
					const cell = cells.get(key(c, r));
					if (!cell) continue;
					count++;
					if (typeof cell.value === 'number') nums.push(cell.value);
				}
			}
		} else if (active) {
			const cell = cells.get(key(active.col, active.row));
			if (cell) {
				count = 1;
				if (typeof cell.value === 'number') nums.push(cell.value);
			}
		}

		const sum = nums.reduce((a, b) => a + b, 0);
		return {
			sum,
			count,
			average: nums.length > 0 ? sum / nums.length : 0,
		};
	});

	// ── Active cell label ───────────────────────────────────────────

	const activeCellLabel = $derived(activeCell ? cellLabel(activeCell.col, activeCell.row) : '');

	const activeCellRaw = $derived.by(() => {
		if (!activeCell) return '';
		const cell = cells.get(key(activeCell.col, activeCell.row));
		return cell?.raw ?? '';
	});

	// ── Serialization ───────────────────────────────────────────────

	/** Serialize to JSONB-compatible sparse map for persistence */
	function toJSON(): Record<string, PersistedCell> {
		const result: Record<string, PersistedCell> = {};
		for (const [k, cell] of cells) {
			const [colStr, rowStr] = k.split(',');
			const label = cellLabel(parseInt(colStr, 10), parseInt(rowStr, 10));
			const persisted: PersistedCell = { v: cell.value };
			if (cell.raw.startsWith('=')) persisted.f = cell.raw;
			result[label] = persisted;
		}
		return result;
	}

	/** Load from JSONB sparse map */
	function fromJSON(data: Record<string, PersistedCell>): void {
		// Build a new Map and reassign — mutation alone doesn't trigger re-renders
		// for cells that were read as undefined during the initial render.
		const next = new Map<string, SpreadsheetCell>();
		for (const [label, persisted] of Object.entries(data)) {
			const ref = parseCellRef(label.toUpperCase());
			if (!ref) continue;
			const raw = persisted.f ?? String(persisted.v ?? '');
			// Store raw value first; formulas re-evaluated after assignment
			const value = persisted.f
				? null
				: typeof persisted.v === 'number'
					? persisted.v
					: evaluateCell(raw, ref.col, ref.row);
			const error = typeof value === 'string' && value.startsWith('#') ? value : null;
			next.set(key(ref.col, ref.row), { raw, value, error });
		}
		// Assign first so getCellValue reads from the populated Map
		cells = next;
		// Now recalculate all formulas against the full dataset
		recalculateAll();
	}

	// ── AI Context serialization ────────────────────────────────────

	/**
	 * Serialize the current state for AI context injection.
	 * Includes selected cells with labeled headers for LLM spatial orientation.
	 */
	function serializeContext(sheetName = 'Sheet1'): { label: string; content: string; tokenEstimate: number } {
		const range = selectionRange;
		const active = activeCell;

		if (!active && !range) {
			return { label: `Spreadsheet: ${sheetName}`, content: '(no selection)', tokenEstimate: 5 };
		}

		// Determine the range to serialize (selection or active cell + neighborhood)
		let minCol: number, maxCol: number, minRow: number, maxRow: number;

		if (range) {
			minCol = Math.min(range.startCol, range.endCol);
			maxCol = Math.max(range.startCol, range.endCol);
			minRow = Math.min(range.startRow, range.endRow);
			maxRow = Math.max(range.startRow, range.endRow);
		} else {
			// Single cell: include 2-cell neighborhood
			const ac = active?.col ?? 0;
			const ar = active?.row ?? 0;
			minCol = Math.max(0, ac - 2);
			maxCol = Math.min(colCount - 1, ac + 2);
			minRow = Math.max(0, ar - 2);
			maxRow = Math.min(rowCount - 1, ar + 2);
		}

		const selLabel = range
			? `${cellLabel(minCol, minRow)}:${cellLabel(maxCol, maxRow)}`
			: cellLabel(active?.col ?? 0, active?.row ?? 0);

		// Build markdown table
		const lines: string[] = [];
		lines.push(`## Spreadsheet: ${sheetName} [Selection: ${selLabel}]`);
		lines.push('');

		// Header row
		const colHeaders = [''];
		for (let c = minCol; c <= maxCol; c++) {
			colHeaders.push(colLabel(c));
		}
		lines.push(`| ${colHeaders.join(' | ')} |`);
		lines.push(`|${colHeaders.map(() => '---').join('|')}|`);

		// Data rows
		const formulas: string[] = [];
		for (let r = minRow; r <= maxRow; r++) {
			const rowCells = [String(r + 1)];
			for (let c = minCol; c <= maxCol; c++) {
				const cell = cells.get(key(c, r));
				if (!cell) {
					rowCells.push('');
				} else {
					const display = cell.error ?? String(cell.value ?? '');
					rowCells.push(redactSensitive(display));
					if (cell.raw.startsWith('=')) {
						formulas.push(`${cellLabel(c, r)}=${cell.raw} → ${display}`);
					}
				}
			}
			lines.push(`| ${rowCells.join(' | ')} |`);
		}

		if (formulas.length > 0) {
			lines.push('');
			lines.push(`Formulas: ${formulas.join(', ')}`);
		}

		const content = lines.join('\n');
		return {
			label: `Spreadsheet: ${sheetName} · ${selLabel}`,
			content,
			tokenEstimate: Math.ceil(content.length / 4),
		};
	}

	return {
		get rows() {
			return rowCount;
		},
		get cols() {
			return colCount;
		},
		get cells() {
			return cells;
		},
		get activeCell() {
			return activeCell;
		},
		get selectionRange() {
			return selectionRange;
		},
		get editing() {
			return editing;
		},
		get editValue() {
			return editValue;
		},
		set editValue(v: string) {
			editValue = v;
		},
		get selectionStats() {
			return selectionStats;
		},
		get activeCellLabel() {
			return activeCellLabel;
		},
		get activeCellRaw() {
			return activeCellRaw;
		},
		get dirty() {
			return dirty;
		},
		getCell,
		getCellValue,
		setCellRaw,
		select,
		startEditing,
		commitEdit,
		cancelEdit,
		moveSelection,
		isInSelection,
		isActiveCell,
		toJSON,
		fromJSON,
		serializeContext,
		colLabel,
	};
}

export type SpreadsheetState = ReturnType<typeof createSpreadsheetState>;
