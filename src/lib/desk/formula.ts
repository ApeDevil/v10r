/**
 * Minimal formula evaluator for desk spreadsheets.
 *
 * Supports: SUM, AVERAGE/AVG, COUNT, MIN, MAX, IF
 * Cell references: A1, B3
 * Ranges: A1:B5, C2:C10
 *
 * Expression evaluation is grid-agnostic: every reference is delegated to a `CellGetter`
 * and this module never learns which cell it is evaluating on behalf of.
 * `createGridResolver` is the getter that spans a whole grid, and it alone owns
 * dependency order, per-pass memoization and cycle detection.
 *
 * It sits below the component layer because a sheet has two writers — the grid and the
 * AI tools — and a value one of them stores must be the value the other would compute.
 * Zero dependencies.
 */

export type CellValue = string | number | null;

/** Function to retrieve a cell's evaluated value by col/row (0-indexed) */
export type CellGetter = (col: number, row: number) => CellValue;

/** A cell's own text by col/row (0-indexed), or undefined where the grid is empty. */
export type RawCellGetter = (col: number, row: number) => string | undefined;

/**
 * What a formula produces when it cannot produce a value.
 *
 * Membership, not a leading "#": a cell holding `#1 pick` is data, and treating it as a
 * failure would both mark it red and poison every aggregate that reads it.
 */
export const FORMULA_ERRORS = ['#ERROR', '#CIRC!'] as const;

export type FormulaError = (typeof FORMULA_ERRORS)[number];

export function isFormulaError(value: CellValue): value is FormulaError {
	return typeof value === 'string' && FORMULA_ERRORS.includes(value as FormulaError);
}

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

/** A cell's own text as a value: numeric text becomes a number, everything else stays text. */
export function parseLiteral(raw: string): CellValue {
	if (raw === '') return null;
	const num = Number(raw);
	return Number.isNaN(num) ? raw : num;
}

/**
 * Build the getter that resolves a whole grid for one recalculation pass.
 *
 * Storage order carries no dependency information — a cell's inputs may be stored after
 * it — so a single sweep reading the previous pass's values reports one generation of
 * staleness per link in the chain. Every reference is instead resolved depth-first
 * through this getter and memoized for the pass, and one `visiting` stack spans cell
 * boundaries so a reference that re-enters a cell still being computed reports #CIRC!
 * rather than that cell's stale value.
 */
export function createGridResolver(getRaw: RawCellGetter): CellGetter {
	const resolved = new Map<string, CellValue>();
	const visiting = new Set<string>();

	const resolve: CellGetter = (col, row) => {
		const label = cellLabel(col, row);
		// A cell value is never undefined, so this distinguishes "memoized as empty".
		const memoized = resolved.get(label);
		if (memoized !== undefined) return memoized;

		const raw = getRaw(col, row);
		if (raw === undefined) return null;
		if (!raw.startsWith('=')) return parseLiteral(raw);
		if (visiting.has(label)) return '#CIRC!';

		visiting.add(label);
		const value = evaluateFormula(raw, resolve);
		visiting.delete(label);
		resolved.set(label, value);
		return value;
	};

	return resolve;
}

/**
 * Evaluate a formula string. Input should start with "=".
 * Returns computed value or one of FORMULA_ERRORS.
 */
export function evaluateFormula(expr: string, getCell: CellGetter): CellValue {
	if (!expr.startsWith('=')) return expr;
	const body = expr.slice(1).trim();
	if (!body) return '#ERROR';

	try {
		return evalExpression(body, getCell);
	} catch {
		return '#ERROR';
	}
}

function evalExpression(expr: string, getCell: CellGetter): CellValue {
	const trimmed = expr.trim();
	const upper = trimmed.toUpperCase();

	// Try function call: FUNC(args) — match case-insensitively, preserve original args
	const fnMatch = upper.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX|IF)\(/);
	if (fnMatch) {
		const fn = fnMatch[1];
		// Extract args preserving original case (skip "FUNC(" and trailing ")")
		const argsStr = trimmed.slice(fn.length + 1, -1);
		return evalFunction(fn, argsStr, getCell);
	}

	// Try cell reference: A1 (case-insensitive)
	const cellRef = parseCellRef(upper);
	if (cellRef) return getCell(cellRef.col, cellRef.row);

	// Try number
	const num = Number(trimmed);
	if (!Number.isNaN(num) && trimmed !== '') return num;

	// Try quoted string (preserve original case)
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1);
	}

	return '#ERROR';
}

function evalFunction(fn: string, argsStr: string, getCell: CellGetter): CellValue {
	if (fn === 'IF') {
		return evalIf(argsStr, getCell);
	}

	// Aggregate functions: resolve all arguments to numeric values
	const values = resolveArgs(argsStr, getCell);
	// A broken input makes the aggregate broken. Summing around a #CIRC! would answer a
	// sheet that has no answer, and the reader would have no reason to distrust the number.
	const failed = values.find(isFormulaError);
	if (failed) return failed;
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
function resolveArgs(argsStr: string, getCell: CellGetter): CellValue[] {
	const values: CellValue[] = [];

	for (const arg of splitTopLevel(argsStr)) {
		const trimmed = arg.trim();

		// Range: A1:B3 (case-insensitive)
		const rangeMatch = trimmed.toUpperCase().match(/^([A-Z]\d+):([A-Z]\d+)$/);
		if (rangeMatch) {
			for (const { col, row } of expandRange(rangeMatch[1], rangeMatch[2])) {
				values.push(getCell(col, row));
			}
			continue;
		}

		// Single value/ref/nested expression
		values.push(evalExpression(trimmed, getCell));
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
function evalIf(argsStr: string, getCell: CellGetter): CellValue {
	const parts = splitTopLevel(argsStr);
	if (parts.length < 3) return '#ERROR';

	const [condStr, trueStr, falseStr] = parts.map((p) => p.trim());

	// Parse comparison: A1>10, B2=5, C3<>"hello"
	const cmpMatch = condStr.match(/^(.+?)\s*(>=|<=|<>|>|<|=)\s*(.+)$/s);
	if (!cmpMatch) return '#ERROR';

	const [, leftExpr, op, rightExpr] = cmpMatch;
	const left = evalExpression(leftExpr, getCell);
	const right = evalExpression(rightExpr, getCell);
	// An unanswerable condition cannot pick a branch — returning the false branch would
	// look like a decision the sheet made.
	const failed = [left, right].find(isFormulaError);
	if (failed) return failed;

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

	return evalExpression(result ? trueStr : falseStr, getCell);
}
