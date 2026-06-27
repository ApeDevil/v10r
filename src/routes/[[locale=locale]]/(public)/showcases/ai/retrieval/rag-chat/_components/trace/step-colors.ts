/**
 * Shared per-PHASE color map for the nRAG trace views (waterfall bars, legend, step list).
 * Phase is the temporal axis the Timing waterfall lays out by — coloring by phase keeps the
 * legend a true color key. Design tokens only (chart hues are theme-aware + distinct).
 *
 * Lifted from the former TraceRail `stepColor` (which keyed by step id) and re-homed on the
 * `NragPhase` axis so both the waterfall adapter and the legend share one source of truth.
 */
import type { NragPhase } from '$lib/types/pipeline';

export const PHASE_COLORS: Record<NragPhase, string> = {
	embed: 'var(--color-primary)',
	retrieve: 'var(--chart-3)',
	fuse: 'var(--chart-7)',
	assemble: 'var(--chart-1)',
	generate: 'var(--chart-4)',
	verify: 'var(--chart-5)',
};

/** Plain-language one-liner per phase (placeholder copy → cony refines). */
export const PHASE_GLOSS: Record<NragPhase, string> = {
	embed: 'Turn the question into a vector',
	retrieve: 'Search every lane in parallel',
	fuse: 'Merge + rank the candidates',
	assemble: 'Build the prompt context',
	generate: 'Stream the model answer',
	verify: 'Check each citation against sources',
};

export function colorForPhase(phase: NragPhase): string {
	return PHASE_COLORS[phase];
}
