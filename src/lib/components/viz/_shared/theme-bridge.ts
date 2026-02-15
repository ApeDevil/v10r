/**
 * Reads CSS custom properties from the document at mount time.
 * Used by viz components to consume design tokens for chart theming.
 */

/** Read a single CSS custom property value (e.g., getCSSVar('chart-1') reads --chart-1) */
export function getCSSVar(token: string): string {
	if (typeof document === 'undefined') return '#000';
	return getComputedStyle(document.documentElement)
		.getPropertyValue(`--${token}`)
		.trim();
}

/** Get the 8-color chart palette from CSS custom properties */
export function getVizPalette(): string[] {
	return [
		getCSSVar('chart-1'),
		getCSSVar('chart-2'),
		getCSSVar('chart-3'),
		getCSSVar('chart-4'),
		getCSSVar('chart-5'),
		getCSSVar('chart-6'),
		getCSSVar('chart-7'),
		getCSSVar('chart-8'),
	];
}

/** Get chart infrastructure colors */
export function getChartInfraColors() {
	return {
		grid: getCSSVar('chart-grid'),
		axis: getCSSVar('chart-axis'),
		label: getCSSVar('chart-label'),
		bg: getCSSVar('chart-bg'),
		tooltipBg: getCSSVar('chart-tooltip-bg'),
	};
}
