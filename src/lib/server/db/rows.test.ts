import { describe, expect, it } from 'vitest';
import { rowCountOf, rowsOf } from './rows';

/**
 * These pin the driver contract. They cannot exercise two real drivers, but they
 * stop the helper from ever being "simplified" back into a cast — which is how a
 * panel ends up permanently empty on whichever driver was not tested.
 */
describe('rowsOf', () => {
	it('unwraps the neon-serverless QueryResult shape', () => {
		expect(rowsOf({ rows: [{ a: 1 }, { a: 2 }], rowCount: 2 })).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it('passes through the pglite bare-array shape', () => {
		expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }]);
	});

	it('returns an empty array for every non-row shape', () => {
		expect(rowsOf(null)).toEqual([]);
		expect(rowsOf(undefined)).toEqual([]);
		expect(rowsOf({})).toEqual([]);
		expect(rowsOf({ rows: null })).toEqual([]);
		expect(rowsOf({ rows: 'nope' })).toEqual([]);
		expect(rowsOf(42)).toEqual([]);
	});

	it('preserves an empty result set', () => {
		expect(rowsOf({ rows: [], rowCount: 0 })).toEqual([]);
		expect(rowsOf([])).toEqual([]);
	});
});

describe('rowCountOf', () => {
	it('counts both driver shapes identically', () => {
		expect(rowCountOf({ rows: [{ a: 1 }, { a: 2 }], rowCount: 2 })).toBe(2);
		expect(rowCountOf([{ a: 1 }, { a: 2 }])).toBe(2);
	});

	it('does not trust rowCount — pglite has none', () => {
		// The trap: reading `.rowCount` directly would give 7 here and `undefined`
		// on pglite. The count must come from the rows themselves.
		expect(rowCountOf({ rows: [{ a: 1 }], rowCount: 7 })).toBe(1);
	});

	it('is zero for non-row shapes', () => {
		expect(rowCountOf(null)).toBe(0);
		expect(rowCountOf({})).toBe(0);
	});
});
