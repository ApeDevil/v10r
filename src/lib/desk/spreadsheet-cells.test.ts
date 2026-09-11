import { describe, expect, it } from 'vitest';
import { persistedCell, rawText, recalculateCells } from './spreadsheet-cells';

describe('rawText / persistedCell', () => {
	it('round-trips a formula through its text and a literal through its value', () => {
		expect(rawText({ v: 6, f: '=SUM(A1:A3)' })).toBe('=SUM(A1:A3)');
		expect(rawText({ v: 42 })).toBe('42');
		expect(rawText({ v: null })).toBe('');
		expect(persistedCell('=B1', 8)).toEqual({ v: 8, f: '=B1' });
		expect(persistedCell('8', 8)).toEqual({ v: 8 });
		expect(persistedCell('8', 8, 'text')).toEqual({ v: 8, t: 'text' });
	});
});

describe('recalculateCells', () => {
	it('re-derives a stored value whose input changed', () => {
		// The AI write path's exact defect: B1 rewritten, the total left as it was.
		const stored = { A1: { v: 2 }, B1: { v: 10 }, C1: { v: 5, f: '=SUM(A1:B1)' } };
		expect(recalculateCells(stored)).toEqual({ A1: { v: 2 }, B1: { v: 10 }, C1: { v: 12, f: '=SUM(A1:B1)' } });
	});

	it('marks a formula written as a bare value and stores its result', () => {
		const stored = { A1: { v: 3 }, A2: { v: 4 }, A3: { v: '=SUM(A1:A2)' } };
		expect(recalculateCells(stored).A3).toEqual({ v: 7, f: '=SUM(A1:A2)' });
	});

	it('resolves in dependency order regardless of storage order', () => {
		const stored = { A1: { v: null, f: '=B1' }, B1: { v: null, f: '=C1' }, C1: { v: 6 } };
		expect(recalculateCells(stored)).toEqual({
			A1: { v: 6, f: '=B1' },
			B1: { v: 6, f: '=C1' },
			C1: { v: 6 },
		});
	});

	it('stores the cycle sentinel rather than a stale number', () => {
		const stored = { A1: { v: 5, f: '=B1' }, B1: { v: 5, f: '=A1' } };
		expect(recalculateCells(stored)).toEqual({ A1: { v: '#CIRC!', f: '=B1' }, B1: { v: '#CIRC!', f: '=A1' } });
	});

	it('is idempotent: a consistent sheet comes back unchanged', () => {
		const once = recalculateCells({ A1: { v: '2' }, B1: { v: 3 }, C1: { v: '=SUM(A1:B1)' } });
		expect(recalculateCells(once)).toEqual(once);
		expect(once).toEqual({ A1: { v: 2 }, B1: { v: 3 }, C1: { v: 5, f: '=SUM(A1:B1)' } });
	});

	it('canonicalises labels, drops empty cells and keeps a format type', () => {
		const stored = { b2: { v: 'x', t: 'text' }, C3: { v: '' }, d4: { v: null }, E5: { v: '  ' } };
		expect(recalculateCells(stored)).toEqual({ B2: { v: 'x', t: 'text' } });
	});

	it('refuses a label the grid cannot address instead of dropping it', () => {
		expect(() => recalculateCells({ AA1: { v: 1 } })).toThrow('"AA1" is not a cell address');
		expect(() => recalculateCells({ total: { v: 1 } })).toThrow(RangeError);
	});
});
