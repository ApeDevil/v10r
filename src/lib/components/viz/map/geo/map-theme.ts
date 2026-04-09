import { getCSSVar } from '../../_shared/theme-bridge';

/** CartoDB tile style URLs for light/dark modes */
export const CARTO_VOYAGER = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
export const CARTO_DARK_MATTER = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * Fetch a CartoDB style and rewrite all `tiles(-*).basemaps.cartocdn.com`
 * URLs to `basemaps.cartocdn.com`. Some browsers / privacy extensions block
 * the `tiles.*` subdomain while the main domain serves the same content.
 *
 * Also resolves vector source TileJSON (`"url"` field) and inlines the tile
 * URLs so MapLibre never fetches the blocked TileJSON endpoint itself.
 */
const styleCache = new Map<string, object>();

const TILES_RE = /https:\/\/tiles(-[a-d])?\.basemaps\.cartocdn\.com/g;
const rewriteUrl = (s: string) => s.replace(TILES_RE, 'https://basemaps.cartocdn.com');

export async function fetchRewrittenStyle(url: string): Promise<object> {
	const cached = styleCache.get(url);
	if (cached) return structuredClone(cached);

	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch map style: ${res.status}`);
	const style = JSON.parse(rewriteUrl(await res.text()));

	// Resolve TileJSON sources so MapLibre doesn't fetch them itself
	if (style.sources) {
		await Promise.all(
			Object.values(style.sources as Record<string, Record<string, unknown>>).map(
				async (src: Record<string, unknown>) => {
					if (src.type === 'vector' && typeof src.url === 'string' && !src.tiles) {
						try {
							const tj = await (await fetch(rewriteUrl(src.url))).json();
							src.tiles = (tj.tiles as string[]).map(rewriteUrl);
							if (tj.minzoom != null) src.minzoom = tj.minzoom;
							if (tj.maxzoom != null) src.maxzoom = tj.maxzoom;
							if (tj.attribution) src.attribution = tj.attribution;
							delete src.url;
						} catch {
							/* fall back to url */
						}
					}
				},
			),
		);
	}

	styleCache.set(url, style);
	return structuredClone(style);
}

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
