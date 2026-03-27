import type { InferSelectModel } from 'drizzle-orm';
import type { customPalettes } from '$lib/server/db/schema/app/custom-palettes';
import type { PaletteColors } from '$lib/styles/random/types';

export type CustomPalette = InferSelectModel<typeof customPalettes>;

export interface CustomPaletteWithColors extends Omit<CustomPalette, 'lightColors' | 'darkColors'> {
	lightColors: PaletteColors;
	darkColors: PaletteColors;
}
