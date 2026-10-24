/**
 * Which design token colours what in a composition scene. A composition names colour *roles*
 * (`tone` on a primitive, `family` on a port standard), never colour values; this is the one
 * place those roles meet `src/app.css`.
 *
 * Families are the caller's vocabulary (`fluid`, `mechanical`, …), so they cannot be mapped by
 * name without putting a domain into the renderer. They are mapped by sorted position onto the
 * chart palette instead — distinct, colour-blind-safe, and stable for a given set of standards.
 */
import type { PortStandard } from '#lib/product-composition/index.ts';

/*
 * A lit body needs a mid tone that stands off the stage in light *and* dark mode. The surface
 * and secondary tokens flip to near-black in dark mode, so the body tones borrow the text
 * ramp instead: `muted` and `body` keep their contrast against the page in every theme.
 */
const TONE_TOKENS: Record<string, string> = {
	surface: 'color-muted',
	muted: 'color-body',
	primary: 'color-primary',
	accent: 'color-accent',
	// Physical materials: the same colour in every theme, as a white boiler is white at night.
	enamel: 'scene-enamel',
	steel: 'scene-steel',
	chrome: 'scene-chrome',
	copper: 'scene-copper',
	brass: 'scene-brass',
	glass: 'scene-glass',
	rubber: 'scene-rubber',
};

/** The room a composition can stand in (`RoomBackdrop`); it turns to night with the dark theme. */
export const ROOM_TOKENS = {
	plaster: 'scene-plaster',
	tile: 'scene-tile',
	trim: 'scene-trim',
	window: 'scene-window',
} as const;

export const FALLBACK_TOKEN = 'color-muted';
/** The selected occurrence or port. */
export const SELECTION_TOKEN = 'color-primary';

const CHART_TOKENS = Array.from({ length: 8 }, (_, index) => `chart-${index + 1}`);

export const toneToken = (tone: string): string => TONE_TOKENS[tone] ?? FALLBACK_TOKEN;

/** Port standard id → the token its ports and conduits are drawn in. */
export function standardTokens(standards: readonly PortStandard[]): Map<string, string> {
	const families = [...new Set(standards.map((standard) => standard.family))].sort();
	const byFamily = new Map(families.map((family, index) => [family, CHART_TOKENS[index % CHART_TOKENS.length]]));
	return new Map(standards.map((standard) => [standard.id, byFamily.get(standard.family) ?? FALLBACK_TOKEN]));
}

/** Every token a scene can ask for — resolved once per theme change. */
export const SCENE_TOKENS = [
	...new Set([...Object.values(TONE_TOKENS), ...Object.values(ROOM_TOKENS), ...CHART_TOKENS, SELECTION_TOKEN]),
];
