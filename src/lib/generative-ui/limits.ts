/**
 * The bounds every generative surface lives inside. A surface is model output, so each limit
 * is a ceiling on what a misbehaving or manipulated model can make the browser do: build a
 * huge tree, nest deep enough to blow a recursive renderer, smuggle a long document through a
 * label, or grow the data model without end.
 *
 * Both doors read the same numbers: the server compiler (`#lib/server/ai/generative-ui/`)
 * refuses a payload over them before it reaches a stream, and the renderer refuses it again
 * before it reaches the message processor, so a fixture or a replayed stream cannot skip them.
 */
export const GENERATIVE_SURFACE_LIMITS = {
	/** Messages in one batch (one tool result, one streamed chunk). */
	maxMessages: 32,
	/** Serialized bytes of one batch. */
	maxBatchBytes: 64 * 1024,
	/** Components a surface may hold, counted after every batch is merged. */
	maxComponents: 120,
	/** Levels below `root`: root's children are depth 1. */
	maxDepth: 10,
	/**
	 * Nodes the renderer would build from `root`, counting every reference. web_core's node
	 * resolver makes one node per reference (a component listed by two parents, or twice by
	 * one, renders twice), so a graph of a few components that share children expands
	 * exponentially without a cycle: 30 levels of a two-way diamond is 2^31 nodes. Twice
	 * `maxComponents` leaves room for legitimate reuse (one Divider in several places).
	 */
	maxRenderedNodes: 240,
	/** Characters in any one string — a label, a cell, a bound value. */
	maxStringLength: 1000,
	/** Nesting of plain JSON values (props, data model values, action context). */
	maxValueDepth: 8,
	/** Serialized bytes of the data model, initial plus every update. */
	maxDataModelBytes: 16 * 1024,
	/** Segments in a data-binding path (`/a/b/c` is three). */
	maxPathSegments: 6,
	/** Table columns and rows. */
	maxTableColumns: 8,
	maxTableRows: 50,
	/** Options in one ChoicePicker. */
	maxChoiceOptions: 20,
	/** Labels (categories or x positions) in one Chart, and series drawn over them. */
	maxChartLabels: 12,
	maxChartSeries: 4,
	/** Components one ArchitectureFlow walks through. */
	maxFlowNodes: 8,
	/** Children listed by one Row or Column. */
	maxChildren: 40,
	/** Keys in one action's context, and its serialized bytes once resolved. */
	maxActionContextKeys: 12,
	maxActionContextBytes: 4 * 1024,
} as const;

export type GenerativeSurfaceLimits = typeof GENERATIVE_SURFACE_LIMITS;
