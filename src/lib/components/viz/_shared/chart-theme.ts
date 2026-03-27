/**
 * Builds a Chart.js-compatible theme object from CSS custom properties.
 * Called at mount time and on dark mode toggle.
 */
import { getChartInfraColors, getVizPalette } from './theme-bridge';

export function buildChartTheme() {
	const palette = getVizPalette();
	const infra = getChartInfraColors();

	return {
		palette,
		defaults: {
			color: infra.label,
			borderColor: infra.grid,
			backgroundColor: palette[0],
			scales: {
				x: {
					grid: { color: infra.grid },
					ticks: { color: infra.axis },
					border: { color: infra.axis },
				},
				y: {
					grid: { color: infra.grid },
					ticks: { color: infra.axis },
					border: { color: infra.axis },
				},
			},
			plugins: {
				legend: {
					labels: { color: infra.label },
				},
				tooltip: {
					backgroundColor: infra.tooltipBg,
					titleColor: infra.label,
					bodyColor: infra.label,
					borderColor: infra.grid,
					borderWidth: 1,
				},
			},
		},
	};
}
