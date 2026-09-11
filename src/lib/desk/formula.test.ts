import { describe, expect, test } from 'vitest';
import {
	type CellGetter,
	type CellValue,
	cellLabel,
	colLabel,
	createGridResolver,
	evaluateFormula,
	expandRange,
	isFormulaError,
	parseCellRef,
	parseLiteral,
} from './formula';

/** Build a CellGetter over a sparse map of "A1" → cell contents. */
function makeGrid(data: Record<string, CellValue>): CellGetter {
	return createGridResolver((col, row) => {
		const raw = data[cellLabel(col, row)];
		return raw === undefined || raw === null ? undefined : String(raw);
	});
}

// Unit: colLabel / cellLabel

describe('colLabel', () => {
	test('converts 0 to A', () => expect(colLabel(0)).toBe('A'));
	test('converts 25 to Z', () => expect(colLabel(25)).toBe('Z'));
});

describe('cellLabel', () => {
	test('converts (0, 0) to A1', () => expect(cellLabel(0, 0)).toBe('A1'));
	test('converts (1, 4) to B5', () => expect(cellLabel(1, 4)).toBe('B5'));
	test('converts (25, 49) to Z50', () => expect(cellLabel(25, 49)).toBe('Z50'));
});

// Unit: parseCellRef

describe('parseCellRef', () => {
	test('parses B5', () => expect(parseCellRef('B5')).toEqual({ col: 1, row: 4 }));
	test('parses A1', () => expect(parseCellRef('A1')).toEqual({ col: 0, row: 0 }));
	test('parses Z50', () => expect(parseCellRef('Z50')).toEqual({ col: 25, row: 49 }));
	test('returns null for lowercase', () => expect(parseCellRef('a1')).toBeNull());
	test('returns null for invalid', () => expect(parseCellRef('ABC')).toBeNull());
	test('returns null for empty', () => expect(parseCellRef('')).toBeNull());
	test('returns null for row 0', () => expect(parseCellRef('A0')).toBeNull());
});

// Unit: expandRange

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

// Unit: evaluateFormula

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

	describe('error propagation', () => {
		test('an unresolvable input breaks the aggregate that reads it', () => {
			const broken = makeGrid({ A1: '=A1', A2: 5 });
			expect(evaluateFormula('=SUM(A1:A2)', broken)).toBe('#CIRC!');
		});

		test('an unresolvable operand breaks the condition rather than picking a branch', () => {
			const broken = makeGrid({ A1: '=A1' });
			expect(evaluateFormula('=IF(A1>1, "yes", "no")', broken)).toBe('#CIRC!');
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

// Unit: parseLiteral / isFormulaError

describe('parseLiteral', () => {
	test('numeric text becomes a number', () => expect(parseLiteral('42')).toBe(42));
	test('negative and decimal text becomes a number', () => expect(parseLiteral('-1.5')).toBe(-1.5));
	test('non-numeric text stays text', () => expect(parseLiteral('12 apples')).toBe('12 apples'));
	test('empty text is an empty cell', () => expect(parseLiteral('')).toBeNull());
});

describe('isFormulaError', () => {
	test('recognises the sentinels', () => {
		expect(isFormulaError('#ERROR')).toBe(true);
		expect(isFormulaError('#CIRC!')).toBe(true);
	});

	test('text that merely starts with a hash is data', () => {
		expect(isFormulaError('#1 pick')).toBe(false);
		expect(isFormulaError('#')).toBe(false);
	});

	test('values are not errors', () => {
		expect(isFormulaError(0)).toBe(false);
		expect(isFormulaError(null)).toBe(false);
	});
});

// Unit: createGridResolver

describe('createGridResolver', () => {
	test('resolves a chain regardless of the order cells are read', () => {
		const grid = makeGrid({ A1: '=B1', B1: '=C1', C1: 1 });
		expect([grid(0, 0), grid(1, 0), grid(2, 0)]).toEqual([1, 1, 1]);
	});

	test('resolves the same chain read from its far end first', () => {
		const grid = makeGrid({ A1: '=B1', B1: '=C1', C1: 1 });
		expect([grid(2, 0), grid(1, 0), grid(0, 0)]).toEqual([1, 1, 1]);
	});

	test('reports a self-reference', () => {
		expect(makeGrid({ A1: '=A1' })(0, 0)).toBe('#CIRC!');
	});

	test('reports both cells of an indirect cycle', () => {
		const grid = makeGrid({ A1: '=B1', B1: '=A1' });
		expect([grid(0, 0), grid(1, 0)]).toEqual(['#CIRC!', '#CIRC!']);
	});

	test('reports a cycle that closes through a range', () => {
		const grid = makeGrid({ A1: '=SUM(B1:B2)', B1: '=A1', B2: 5 });
		expect([grid(0, 0), grid(1, 0)]).toEqual(['#CIRC!', '#CIRC!']);
	});

	test('a shared dependency is evaluated once per pass', () => {
		const reads: string[] = [];
		const resolve = createGridResolver((col, row) => {
			const label = cellLabel(col, row);
			reads.push(label);
			return { A1: '=SUM(C1,C1)', B1: '=C1', C1: '=1' }[label];
		});
		expect([resolve(0, 0), resolve(1, 0)]).toEqual([2, 1]);
		expect(reads.filter((label) => label === 'C1')).toHaveLength(1);
	});

	test('an empty cell resolves to null, not zero', () => {
		expect(makeGrid({})(0, 0)).toBeNull();
	});
});
