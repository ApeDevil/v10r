/**
 * Windowing arithmetic: which rows of a large list are worth existing right now.
 *
 * A virtualized list costs roughly the size of the viewport instead of the size of
 * the data — ten thousand rows render as the thirty that fit plus a margin. The cost
 * it removes is not just DOM nodes: layout, style recalculation and hit-testing are
 * all proportional to what is in the tree, which is why a long list gets slower to
 * SCROLL, not merely slower to appear.
 *
 * The maths lives here, separate from the component, for two reasons. It is the part
 * with edge cases worth pinning (empty lists, a viewport taller than the data, a
 * scroll position past the end after a shrink), and it is the part that can be tested
 * without a browser — the component's half is effects, which vitest's node
 * environment never runs.
 *
 * Uniform row height only, on purpose. Variable heights need measurement, a resize
 * observer and a running offset table, and every one of those is a source of scroll
 * jump. A list that needs them is a different pattern, not an option on this one.
 */

export interface WindowInput {
	/** Current scroll offset of the viewport, in pixels. */
	scrollTop: number;
	/** Visible height of the scroll container, in pixels. */
	viewportHeight: number;
	/** Height of one row, in pixels. Uniform. */
	itemHeight: number;
	/** Total number of items in the data. */
	count: number;
	/** Rows to render beyond each edge, hiding the gap during a fast flick. */
	overscan: number;
}

export interface VirtualWindow {
	/** First index to render, inclusive. */
	start: number;
	/** Last index to render, EXCLUSIVE — slice-shaped, so `items.slice(start, end)` is right. */
	end: number;
	/** Pixels to push the rendered block down by, so it sits where its rows belong. */
	offsetTop: number;
	/** Full scrollable height, so the scrollbar reflects the data and not the window. */
	totalHeight: number;
}

/** Overscan that hides the gap on an ordinary flick without rendering a second screen. */
export const DEFAULT_OVERSCAN = 4;

/**
 * Below this, virtualization costs more than it saves.
 *
 * Not a hard limit — a caller may still virtualize a shorter list — but the number
 * the showcase and the docs point at when asking whether it is worth the complexity
 * at all. Two hundred rows of plain text render fine.
 */
export const VIRTUALIZE_ABOVE = 200;

export function computeWindow(input: WindowInput): VirtualWindow {
	const { viewportHeight, itemHeight, count, overscan } = input;
	const totalHeight = Math.max(0, count) * Math.max(1, itemHeight);

	if (count <= 0 || itemHeight <= 0 || viewportHeight <= 0) {
		return { start: 0, end: 0, offsetTop: 0, totalHeight };
	}

	// Clamped BEFORE dividing: a scrollTop past the end (the list shrank under the
	// user, or a browser restored a stale position) would otherwise produce a start
	// index beyond the data and render an empty screen the user cannot scroll out of.
	const maxScroll = Math.max(0, totalHeight - viewportHeight);
	const scrollTop = Math.min(Math.max(0, input.scrollTop), maxScroll);

	const firstVisible = Math.floor(scrollTop / itemHeight);
	const visibleCount = Math.ceil(viewportHeight / itemHeight);

	const start = Math.max(0, firstVisible - overscan);
	// +1 because a viewport boundary mid-row still shows that row.
	const end = Math.min(count, firstVisible + visibleCount + overscan + 1);

	return { start, end, offsetTop: start * itemHeight, totalHeight };
}

/** Scroll offset that brings `index` to the top of the viewport. */
export function offsetForIndex(index: number, itemHeight: number, count: number): number {
	const clamped = Math.min(Math.max(0, index), Math.max(0, count - 1));
	return clamped * itemHeight;
}
