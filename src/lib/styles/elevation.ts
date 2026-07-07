/**
 * Surface elevation — level algebra (the twin of `floating.ts`).
 *
 * `floating.ts` owns floating *geometry*; this owns the *level* of the same surfaces.
 * Elevation is RELATIVE: a surface's level is its parent surface's level + 1, resolved
 * once at component init and stamped as a clamped `data-elevation="1..4"` attribute that
 * the `[data-elevation]` block in `app.css` turns into fill / rim / glow. There are NO
 * hardcoded rungs and NO floors — the only literal in the whole system is the root plane
 * (level 0, the default when no ancestor surface exists).
 *
 * Why a Svelte context and not a CSS/DOM counter: Bits UI portals floating content to
 * <body>, so the DOM parent of a menu/dialog/tooltip is the page, not its trigger. CSS
 * inheritance follows the DOM and would collapse every portalled surface to level 0. Svelte
 * context follows the COMPONENT tree — the Portal relocates DOM nodes, not ownership — so the
 * level resolved at the trigger (a real component-tree descendant of the parent surface)
 * survives the portal. This is the same context-through-portal fact Bits' own Root→Content
 * relies on.
 *
 * The stored context value is the UNCLAMPED depth (so a child computes an honest parent + 1
 * past the ceiling); only the emitted attribute is clamped to the token range. Level is a
 * bare number resolved at init — never reactive (nothing mutates a surface's plane at
 * runtime), which keeps this module rune-free and SSR-safe.
 */
import { getContext, setContext } from 'svelte';

const SURFACE_LEVEL = Symbol('surface-level');

/** Highest rung with a distinct token; deeper surfaces saturate here (z-order + overlap + rim carry beyond). */
export const ELEVATION_CEILING = 4;

export interface SurfaceOptions {
	/** Hard override — ignore the parent and pin this level (rare reset roots). Omit for pure `parent + 1`. */
	level?: number;
}

export interface SurfaceResult {
	/** Unclamped logical depth (may exceed the ceiling); provided to descendants. */
	depth: number;
	/** Clamped display rung, 0..4 (0 = the page plane). */
	display: number;
	/** Spread onto the surface element. `data-elevation` present only for rungs ≥ 1. */
	attrs: { 'data-elevation'?: string };
}

/** The parent surface's level, or 0 (the page plane) when no ancestor surface exists. */
export function getParentLevel(): number {
	return getContext<number>(SURFACE_LEVEL) ?? 0;
}

/** Clamp a level to the token range and format it as the attribute value (undefined for the page plane). */
export function elevationAttr(level: number): string | undefined {
	return level <= 0 ? undefined : String(Math.min(ELEVATION_CEILING, level));
}

/** Pure level algebra: an explicit override, else parent + 1. Exposed for unit tests and hand-wired call-sites. */
export function resolveLevel(opts: SurfaceOptions = {}, parent: number = getParentLevel()): number {
	return opts.level ?? parent + 1;
}

/**
 * Resolve this surface's level, provide it to descendants, and return the attrs to stamp.
 * Call once, at component init. Because it seeds context, a nested `<Surface>` inside a
 * portalled floating body still climbs correctly from here.
 */
export function useSurface(opts: SurfaceOptions = {}): SurfaceResult {
	const depth = resolveLevel(opts);
	setContext(SURFACE_LEVEL, depth);
	const display = Math.min(depth, ELEVATION_CEILING);
	return {
		depth,
		display,
		attrs: display > 0 ? { 'data-elevation': String(display) } : {},
	};
}
