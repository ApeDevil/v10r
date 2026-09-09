import { describe, expect, it } from 'vitest';
import { computeWindow, DEFAULT_OVERSCAN, offsetForIndex, type WindowInput } from './virtual-list';

const base: WindowInput = {
	scrollTop: 0,
	viewportHeight: 400,
	itemHeight: 40,
	count: 10_000,
	overscan: DEFAULT_OVERSCAN,
};

describe('computeWindow', () => {
	it('renders the viewport plus overscan, not the dataset', () => {
		const window = computeWindow(base);

		// 10 rows fit; +1 for a partial row at the boundary, +4 overscan below.
		expect(window.end - window.start).toBe(15);
		expect(window.start).toBe(0);
	});

	it('gives the scrollbar the full data height', () => {
		expect(computeWindow(base).totalHeight).toBe(400_000);
	});

	it('offsets the rendered block to where its rows belong', () => {
		const window = computeWindow({ ...base, scrollTop: 4000 });

		expect(window.start).toBe(96); // row 100 minus 4 overscan
		expect(window.offsetTop).toBe(96 * 40);
	});

	it('never starts before the first row', () => {
		const window = computeWindow({ ...base, scrollTop: 40 });

		expect(window.start).toBe(0);
		expect(window.offsetTop).toBe(0);
	});

	it('never ends past the last row', () => {
		const window = computeWindow({ ...base, scrollTop: 400_000 });

		expect(window.end).toBe(10_000);
		expect(window.start).toBeLessThan(window.end);
	});

	it('clamps a scroll position past the end instead of rendering nothing', () => {
		// The list shrank under the user, or the browser restored a stale position.
		// An unclamped divide would put `start` beyond `count` and strand them on a
		// blank screen they cannot scroll out of.
		const window = computeWindow({ ...base, count: 5, scrollTop: 999_999 });

		expect(window.start).toBe(0);
		expect(window.end).toBe(5);
	});

	it('renders nothing for an empty list, and still reports a height of zero', () => {
		expect(computeWindow({ ...base, count: 0 })).toEqual({ start: 0, end: 0, offsetTop: 0, totalHeight: 0 });
	});

	it('renders nothing before the viewport has been measured', () => {
		// First paint: clientHeight is 0 until the element is in the document.
		expect(computeWindow({ ...base, viewportHeight: 0 }).end).toBe(0);
	});

	it('renders the whole list when the viewport is taller than the data', () => {
		const window = computeWindow({ ...base, count: 3, viewportHeight: 4000 });

		expect(window.start).toBe(0);
		expect(window.end).toBe(3);
	});

	it('covers every scroll position without a gap', () => {
		// Walk the list a screen at a time; the rendered window must always contain
		// the rows that are actually on screen.
		for (let scrollTop = 0; scrollTop <= 399_600; scrollTop += 397) {
			const window = computeWindow({ ...base, scrollTop });
			const firstOnScreen = Math.floor(scrollTop / 40);
			const lastOnScreen = Math.floor((scrollTop + 399) / 40);

			expect(window.start).toBeLessThanOrEqual(firstOnScreen);
			expect(window.end).toBeGreaterThan(lastOnScreen);
		}
	});
});

describe('offsetForIndex', () => {
	it('maps an index to its scroll position', () => {
		expect(offsetForIndex(10, 40, 100)).toBe(400);
	});

	it('clamps out-of-range indices to the list', () => {
		expect(offsetForIndex(-5, 40, 100)).toBe(0);
		expect(offsetForIndex(500, 40, 100)).toBe(99 * 40);
	});

	it('stays at zero for an empty list', () => {
		expect(offsetForIndex(3, 40, 0)).toBe(0);
	});
});
