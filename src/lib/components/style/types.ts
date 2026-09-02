/** A custom palette owned by the signed-in visitor, as sent to the browser. */
export interface OwnedPalette {
	id: string;
	name: string;
	description: string | null;
	basePaletteId: string;
	lightColors: unknown;
	darkColors: unknown;
}
