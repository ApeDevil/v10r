/**
 * Style domain — the palette / typography / shape selection a visitor makes, and the
 * custom palettes they author.
 *
 * Named for the product word: the routes are `/api/style/*`, the client state is
 * `state/style.svelte.ts`, and the showcase is `/showcases/shell/style`. Palette CRUD
 * used to sit in a separate `branding/` directory, which was the only place in the stack
 * that called this concept something else.
 */

export {
	type CustomPaletteRow,
	countCustomPalettes,
	createCustomPalette,
	deleteCustomPalette,
	getCustomPaletteById,
	listCustomPalettes,
	updateCustomPalette,
} from './palettes';
export { saveStyleToDb } from './persist';
