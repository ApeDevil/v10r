/**
 * The asset production showcase's starting points: three parameter sets that differ in kind,
 * not just size — a bare outpost, the default ring, a large station near the top of the
 * budget. Plain requests for the shared schema; nothing here is showcase-only geometry.
 */
import { STRUCTURAL_RING_DEFAULTS, type StructuralRingParameters } from '#lib/schemas/asset-production.ts';

export type ProducePresetId = 'outpost' | 'default' | 'station';

export const PRODUCE_PRESETS: Record<ProducePresetId, StructuralRingParameters> = {
	outpost: {
		...STRUCTURAL_RING_DEFAULTS,
		ringRadius: 4,
		bays: 12,
		trussDepth: 0.6,
		trussHeight: 0.6,
		spokes: 3,
		hubRadius: 0.8,
		modules: 3,
		bracing: 'pratt',
	},
	default: STRUCTURAL_RING_DEFAULTS,
	station: {
		...STRUCTURAL_RING_DEFAULTS,
		ringRadius: 22,
		bays: 56,
		trussDepth: 2,
		trussHeight: 1.6,
		strutRadius: 0.06,
		spokes: 8,
		hubRadius: 3,
		modules: 28,
		detail: 10,
		bracing: 'x-brace',
	},
};
