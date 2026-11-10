import { describe, expect, it } from 'vitest';
import { dropGap, gapToIndex } from './row-drop-target.ts';

describe('dropGap', () => {
	const mids = [10, 30, 50];

	it('points above the first row', () => expect(dropGap(mids, 0)).toBe(0));
	it('points between rows', () => expect(dropGap(mids, 40)).toBe(2));
	it('points below the last row', () => expect(dropGap(mids, 99)).toBe(3));
	it('is the end gap for an empty list', () => expect(dropGap([], 5)).toBe(0));
});

describe('gapToIndex', () => {
	it('is null for the gaps around the row itself', () => {
		expect(gapToIndex(2, 2)).toBeNull();
		expect(gapToIndex(2, 3)).toBeNull();
	});
	it('moves up into the gap', () => expect(gapToIndex(3, 0)).toBe(0));
	it('moves down to the index before the gap', () => expect(gapToIndex(0, 3)).toBe(2));
	it('moves to the end', () => expect(gapToIndex(0, 4)).toBe(3));
});
