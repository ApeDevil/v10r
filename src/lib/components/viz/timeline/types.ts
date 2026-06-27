/**
 * Generic, domain-agnostic waterfall (Gantt-style timeline) contract.
 *
 * This module MUST NOT import from `$lib/types/pipeline` (or any domain type) — it is a
 * reusable viz primitive. Route adapters map their domain rows → `WaterfallRow[]`.
 */

export type WaterfallStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

/** One bar on the timeline. Geometry is derived from `startOffsetMs` + `durationMs`. */
export interface WaterfallRow {
	id: string;
	label: string;
	/** ms from t0 → bar left edge. */
	startOffsetMs: number;
	/** ms span → bar width. */
	durationMs: number;
	status: WaterfallStatus;
	/** Bar fill — a design-token CSS value (e.g. `var(--chart-3)`). */
	color: string;
	/** Optional lane tag (source axis); purely informational here. */
	laneId?: string;
	/** Rows sharing a `groupId` render under one band label. */
	groupId?: string;
	/** Human band label for the group. */
	groupLabel?: string;
	/** Indent depth (e.g. drill ticks nested under generate). */
	depth?: number;
	/** Parent row id (informational; nesting is visual via `depth`). */
	parentId?: string;
}

export interface WaterfallProps {
	rows: WaterfallRow[];
	/** Explicit time span. Defaults to max(startOffsetMs + durationMs) — NEVER a sum. */
	totalMs?: number;
	selectedId?: string | null;
	onselect?: (id: string) => void;
}
