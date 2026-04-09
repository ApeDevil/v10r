/**
 * Minimal formula evaluator for the desk spreadsheet panel.
 *
 * Supports: SUM, AVERAGE/AVG, COUNT, MIN, MAX, IF
 * Cell references: A1, B3
 * Ranges: A1:B5, C2:C10
 * Circular detection via visiting set.
 *
 * ~150 lines, zero dependencies.
 */

export type CellValue = string | number | null;

/** Function to retrieve a cell's evaluated value by col/row (0-indexed) */
export type CellGetter = (col: number, row: number) => CellValue;

/** Convert 0-indexed column to letter: 0 → "A", 25 → "Z" */
export function colLabel(col: number): string {
	return String.fromCharCode(65 + col);
}

/** Convert col/row (0-indexed) to cell label: (1, 0) → "B1" */
export function cellLabel(col: number, row: number): string {
	return `${colLabel(col)}${row + 1}`;
}

/** Parse a cell reference like "B5" into {col: 1, row: 4} (0-indexed). Returns null if invalid. */
export function parseCellRef(ref: string): { col: number; row: number } | null {
	const match = ref.match(/^([A-Z])(\d+)$/);
	if (!match) return null;
	const col = match[1].charCodeAt(0) - 65;
	const row = parseInt(match[2], 10) - 1;
	if (col < 0 || col > 25 || row < 0) return null;
	return { col, row };
}

/** Expand a range like "A1:C3" into an array of {col, row} addresses */
export function expandRange(from: string, to: string): { col: number; row: number }[] {
	const start = parseCellRef(from);
	const end = parseCellRef(to);
	if (!start || !end) return [];

	const cells: { col: number; row: number }[] = [];
	const minCol = Math.min(start.col, end.col);
	const maxCol = Math.max(start.col, end.col);
	const minRow = Math.min(start.row, end.row);
	const maxRow = Math.max(start.row, end.row);

	for (let r = minRow; r <= maxRow; r++) {
		for (let c = minCol; c <= maxCol; c++) {
			cells.push({ col: c, row: r });
		}
	}
	return cells;
}

/**
 * Evaluate a formula string. Input should start with "=".
 * Returns computed value or an error string prefixed with "#".
 */
export function evaluateFormula(expr: string, getCell: CellGetter, visiting: Set<string> = new Set()): CellValue {
	if (!expr.startsWith('=')) return expr;
	const body = expr.slice(1).trim();
	if (!body) return '#ERROR';

	try {
		return evalExpression(body, getCell, visiting);
	} catch {
		return '#ERROR';
	}
}

// ── Internal parser ──────────────────────────────────────────────────

function evalExpression(expr: string, getCell: CellGetter, visiting: Set<string>): CellValue {
	const trimmed = expr.trim();
	const upper = trimmed.toUpperCase();

	// Try function call: FUNC(args) — match case-insensitively, preserve original args
	const fnMatch = upper.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX|IF)\(/);
	if (fnMatch) {
		const fn = fnMatch[1];
		// Extract args preserving original case (skip "FUNC(" and trailing ")")
		const argsStr = trimmed.slice(fn.length + 1, -1);
		return evalFunction(fn, argsStr, getCell, visiting);
	}

	// Try cell reference: A1 (case-insensitive)
	const cellRef = parseCellRef(upper);
	if (cellRef) {
		const key = cellLabel(cellRef.col, cellRef.row);
		if (visiting.has(key)) return '#CIRC!';
		return getCell(cellRef.col, cellRef.row);
	}

	// Try number
	const num = Number(trimmed);
	if (!Number.isNaN(num) && trimmed !== '') return num;

	// Try quoted string (preserve original case)
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1);
	}

	return '#ERROR';
}

function evalFunction(fn: string, argsStr: string, getCell: CellGetter, visiting: Set<string>): CellValue {
	if (fn === 'IF') {
		return evalIf(argsStr, getCell, visiting);
	}

	// Aggregate functions: resolve all arguments to numeric values
	const values = resolveArgs(argsStr, getCell, visiting);
	const nums = values.filter((v): v is number => typeof v === 'number');

	switch (fn) {
		case 'SUM':
			return nums.reduce((a, b) => a + b, 0);
		case 'AVERAGE':
		case 'AVG':
			return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
		case 'COUNT':
			return values.filter((v) => v !== null && v !== '').length;
		case 'MIN':
			return nums.length > 0 ? Math.min(...nums) : 0;
		case 'MAX':
			return nums.length > 0 ? Math.max(...nums) : 0;
		default:
			return '#ERROR';
	}
}

/** Resolve comma-separated args, expanding ranges into individual values */
function resolveArgs(argsStr: string, getCell: CellGetter, visiting: Set<string>): CellValue[] {
	const values: CellValue[] = [];

	for (const arg of splitTopLevel(argsStr)) {
		const trimmed = arg.trim();

		// Range: A1:B3 (case-insensitive)
		const rangeMatch = trimmed.toUpperCase().match(/^([A-Z]\d+):([A-Z]\d+)$/);
		if (rangeMatch) {
			const cells = expandRange(rangeMatch[1], rangeMatch[2]);
			for (const { col, row } of cells) {
				const key = cellLabel(col, row);
				if (visiting.has(key)) {
					values.push('#CIRC!' as CellValue);
					continue;
				}
				values.push(getCell(col, row));
			}
			continue;
		}

		// Single value/ref/nested expression
		values.push(evalExpression(trimmed, getCell, visiting));
	}

	return values;
}

/** Split string by commas, respecting parentheses depth */
function splitTopLevel(str: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = '';

	for (const ch of str) {
		if (ch === '(') depth++;
		else if (ch === ')') depth--;

		if (ch === ',' && depth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	if (current) parts.push(current);
	return parts;
}

/** Evaluate IF(condition, trueVal, falseVal) */
function evalIf(argsStr: string, getCell: CellGetter, visiting: Set<string>): CellValue {
	const parts = splitTopLevel(argsStr);
	if (parts.length < 3) return '#ERROR';

	const [condStr, trueStr, falseStr] = parts.map((p) => p.trim());

	// Parse comparison: A1>10, B2=5, C3<>"hello"
	const cmpMatch = condStr.match(/^(.+?)\s*(>=|<=|<>|>|<|=)\s*(.+)$/s);
	if (!cmpMatch) return '#ERROR';

	const [, leftExpr, op, rightExpr] = cmpMatch;
	const left = evalExpression(leftExpr, getCell, visiting);
	const right = evalExpression(rightExpr, getCell, visiting);

	const leftNum = typeof left === 'number' ? left : Number(left);
	const rightNum = typeof right === 'number' ? right : Number(right);
	const useNumeric = !Number.isNaN(leftNum) && !Number.isNaN(rightNum);

	let result: boolean;
	switch (op) {
		case '>':
			result = useNumeric ? leftNum > rightNum : String(left) > String(right);
			break;
		case '<':
			result = useNumeric ? leftNum < rightNum : String(left) < String(right);
			break;
		case '=':
			result = useNumeric ? leftNum === rightNum : String(left) === String(right);
			break;
		case '>=':
			result = useNumeric ? leftNum >= rightNum : String(left) >= String(right);
			break;
		case '<=':
			result = useNumeric ? leftNum <= rightNum : String(left) <= String(right);
			break;
		case '<>':
			result = useNumeric ? leftNum !== rightNum : String(left) !== String(right);
			break;
		default:
			return '#ERROR';
	}

	return evalExpression(result ? trueStr : falseStr, getCell, visiting);
}
