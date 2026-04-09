import { describe, expect, test } from 'vitest';
import {
	type CellGetter,
	type CellValue,
	cellLabel,
	colLabel,
	evaluateFormula,
	expandRange,
	parseCellRef,
} from './formula';

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a CellGetter from a sparse map of "A1" → value */
function makeGrid(data: Record<string, CellValue>): CellGetter {
	return (col, row) => {
		const key = cellLabel(col, row);
		const raw = data[key] ?? null;
		// If the value is a formula, evaluate it recursively
		if (typeof raw === 'string' && raw.startsWith('=')) {
			return evaluateFormula(raw, makeGrid(data), new Set([key]));
		}
		return raw;
	};
}

// ── Unit: colLabel / cellLabel ───────────────────────────────────────

describe('colLabel', () => {
	test('converts 0 to A', () => expect(colLabel(0)).toBe('A'));
	test('converts 25 to Z', () => expect(colLabel(25)).toBe('Z'));
});

describe('cellLabel', () => {
	test('converts (0, 0) to A1', () => expect(cellLabel(0, 0)).toBe('A1'));
	test('converts (1, 4) to B5', () => expect(cellLabel(1, 4)).toBe('B5'));
	test('converts (25, 49) to Z50', () => expect(cellLabel(25, 49)).toBe('Z50'));
});

// ── Unit: parseCellRef ───────────────────────────────────────────────

describe('parseCellRef', () => {
	test('parses B5', () => expect(parseCellRef('B5')).toEqual({ col: 1, row: 4 }));
	test('parses A1', () => expect(parseCellRef('A1')).toEqual({ col: 0, row: 0 }));
	test('parses Z50', () => expect(parseCellRef('Z50')).toEqual({ col: 25, row: 49 }));
	test('returns null for lowercase', () => expect(parseCellRef('a1')).toBeNull());
	test('returns null for invalid', () => expect(parseCellRef('ABC')).toBeNull());
	test('returns null for empty', () => expect(parseCellRef('')).toBeNull());
	test('returns null for row 0', () => expect(parseCellRef('A0')).toBeNull());
});

// ── Unit: expandRange ────────────────────────────────────────────────

describe('expandRange', () => {
	test('single cell range A1:A1', () => {
		expect(expandRange('A1', 'A1')).toEqual([{ col: 0, row: 0 }]);
	});

	test('column range A1:A3', () => {
		expect(expandRange('A1', 'A3')).toEqual([
			{ col: 0, row: 0 },
			{ col: 0, row: 1 },
			{ col: 0, row: 2 },
		]);
	});

	test('rect range A1:B2', () => {
		expect(expandRange('A1', 'B2')).toEqual([
			{ col: 0, row: 0 },
			{ col: 1, row: 0 },
			{ col: 0, row: 1 },
			{ col: 1, row: 1 },
		]);
	});

	test('reverse order B2:A1 produces same cells', () => {
		const cells = expandRange('B2', 'A1');
		expect(cells).toHaveLength(4);
		expect(cells).toContainEqual({ col: 0, row: 0 });
		expect(cells).toContainEqual({ col: 1, row: 1 });
	});

	test('returns empty for invalid refs', () => {
		expect(expandRange('ZZ', 'A1')).toEqual([]);
	});
});

// ── Unit: evaluateFormula ────────────────────────────────────────────

describe('evaluateFormula', () => {
	const grid = makeGrid({
		A1: 10,
		A2: 20,
		A3: 30,
		A4: 'text',
		A5: null,
		B1: 5,
		B2: 15,
		B3: 25,
	});

	test('non-formula returns as-is', () => {
		expect(evaluateFormula('hello', grid)).toBe('hello');
	});

	test('empty formula returns #ERROR', () => {
		expect(evaluateFormula('=', grid)).toBe('#ERROR');
	});

	describe('SUM', () => {
		test('sums a column range', () => {
			expect(evaluateFormula('=SUM(A1:A3)', grid)).toBe(60);
		});

		test('sums across columns', () => {
			expect(evaluateFormula('=SUM(A1:B1)', grid)).toBe(15);
		});

		test('ignores non-numeric values', () => {
			expect(evaluateFormula('=SUM(A1:A5)', grid)).toBe(60);
		});

		test('empty range returns 0', () => {
			expect(evaluateFormula('=SUM(Z1:Z5)', grid)).toBe(0);
		});
	});

	describe('AVERAGE / AVG', () => {
		test('averages a range', () => {
			expect(evaluateFormula('=AVERAGE(A1:A3)', grid)).toBe(20);
		});

		test('AVG alias works', () => {
			expect(evaluateFormula('=AVG(A1:A3)', grid)).toBe(20);
		});

		test('empty numeric range returns 0', () => {
			expect(evaluateFormula('=AVERAGE(Z1:Z3)', grid)).toBe(0);
		});
	});

	describe('COUNT', () => {
		test('counts non-empty cells', () => {
			expect(evaluateFormula('=COUNT(A1:A5)', grid)).toBe(4);
		});

		test('counts full range', () => {
			expect(evaluateFormula('=COUNT(A1:A3)', grid)).toBe(3);
		});
	});

	describe('MIN / MAX', () => {
		test('finds minimum', () => {
			expect(evaluateFormula('=MIN(A1:A3)', grid)).toBe(10);
		});

		test('finds maximum', () => {
			expect(evaluateFormula('=MAX(A1:B3)', grid)).toBe(30);
		});

		test('empty range returns 0', () => {
			expect(evaluateFormula('=MIN(Z1:Z3)', grid)).toBe(0);
		});
	});

	describe('IF', () => {
		test('true condition', () => {
			expect(evaluateFormula('=IF(A1>5, "yes", "no")', grid)).toBe('yes');
		});

		test('false condition', () => {
			expect(evaluateFormula('=IF(A1>50, "big", "small")', grid)).toBe('small');
		});

		test('equality', () => {
			expect(evaluateFormula('=IF(A1=10, "exact", "nope")', grid)).toBe('exact');
		});

		test('not equal', () => {
			expect(evaluateFormula('=IF(A1<>10, "diff", "same")', grid)).toBe('same');
		});

		test('returns cell reference value', () => {
			expect(evaluateFormula('=IF(A1>5, B1, B2)', grid)).toBe(5);
		});

		test('less than or equal', () => {
			expect(evaluateFormula('=IF(A1<=10, "ok", "no")', grid)).toBe('ok');
		});

		test('greater than or equal', () => {
			expect(evaluateFormula('=IF(A1>=11, "yes", "no")', grid)).toBe('no');
		});
	});

	describe('cell references', () => {
		test('resolves single cell ref', () => {
			expect(evaluateFormula('=A1', grid)).toBe(10);
		});

		test('lowercase ref resolves (case-insensitive)', () => {
			expect(evaluateFormula('=a1', grid)).toBe(10);
		});
	});

	describe('circular reference detection', () => {
		test('detects direct circular ref', () => {
			const circGrid = makeGrid({ A1: '=A1' });
			expect(evaluateFormula('=A1', circGrid)).toBe('#CIRC!');
		});
	});

	describe('numbers and strings', () => {
		test('evaluates plain number', () => {
			expect(evaluateFormula('=42', grid)).toBe(42);
		});

		test('evaluates quoted string', () => {
			expect(evaluateFormula('="hello"', grid)).toBe('hello');
		});
	});
});
