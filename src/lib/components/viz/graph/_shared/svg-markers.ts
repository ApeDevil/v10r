/** SVG marker definitions for directed graph edges */

export interface MarkerConfig {
	id: string;
	viewBox: string;
	refX: number;
	refY: number;
	markerWidth: number;
	markerHeight: number;
	path: string;
}

/** Default arrow marker for directed edges. refX offset accounts for node radius. */
export const arrowMarker: MarkerConfig = {
	id: 'graph-arrow',
	viewBox: '0 -5 10 10',
	refX: 20,
	refY: 0,
	markerWidth: 6,
	markerHeight: 6,
	path: 'M0,-5L10,0L0,5',
};
