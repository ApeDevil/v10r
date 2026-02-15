/** CartoDB tile style URLs for light/dark modes */
export const CARTO_VOYAGER = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
export const CARTO_DARK_MATTER = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

import { getCSSVar } from '../../_shared/theme-bridge';

/** Read design tokens for map UI theming */
export function getMapThemeColors() {
	return {
		primary: getCSSVar('color-primary'),
		surface: getCSSVar('surface-1'),
		fg: getCSSVar('color-fg'),
		border: getCSSVar('color-border'),
		muted: getCSSVar('color-muted'),
	};
}
