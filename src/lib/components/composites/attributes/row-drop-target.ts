/**
 * Where a dragged attribute row lands. Pure geometry, no DOM: the editor measures the rows,
 * this decides the gap. A gap is a slot between rows — 0 is above the first, `count` below the
 * last — so the drop indicator has one place to draw and the move has one index to apply.
 */

/** The gap the pointer at `y` points to, given each row's vertical midpoint, top to bottom. */
export function dropGap(midpoints: readonly number[], y: number): number {
	const gap = midpoints.findIndex((mid) => y < mid);
	return gap === -1 ? midpoints.length : gap;
}

/**
 * The index `moveAttribute` takes for a row dropped into `gap`, or `null` when the drop puts it
 * back where it was (the gaps directly above and below the row itself).
 */
export function gapToIndex(from: number, gap: number): number | null {
	if (gap === from || gap === from + 1) return null;
	return gap > from ? gap - 1 : gap;
}
