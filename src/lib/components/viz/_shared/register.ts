/**
 * Chart.js selective registration helpers.
 * Each chart type registers only the components it needs for tree-shaking.
 */

/** Register bar chart components */
export async function registerBarChart() {
	const {
		Chart,
		BarController,
		CategoryScale,
		LinearScale,
		BarElement,
		Tooltip,
		Legend,
	} = await import('chart.js');

	Chart.register(BarController, CategoryScale, LinearScale, BarElement, Tooltip, Legend);
	return Chart;
}

/** Register line chart components */
export async function registerLineChart() {
	const {
		Chart,
		LineController,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Tooltip,
		Legend,
		Filler,
	} = await import('chart.js');

	Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);
	return Chart;
}

/** Register pie/doughnut chart components */
export async function registerPieChart() {
	const {
		Chart,
		PieController,
		DoughnutController,
		ArcElement,
		Tooltip,
		Legend,
	} = await import('chart.js');

	Chart.register(PieController, DoughnutController, ArcElement, Tooltip, Legend);
	return Chart;
}

/** Register scatter chart components */
export async function registerScatterChart() {
	const {
		Chart,
		ScatterController,
		LinearScale,
		PointElement,
		Tooltip,
		Legend,
	} = await import('chart.js');

	Chart.register(ScatterController, LinearScale, PointElement, Tooltip, Legend);
	return Chart;
}

/** Register radar chart components */
export async function registerRadarChart() {
	const {
		Chart,
		RadarController,
		RadialLinearScale,
		PointElement,
		LineElement,
		Filler,
		Tooltip,
		Legend,
	} = await import('chart.js');

	Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
	return Chart;
}

/** Register bubble chart components */
export async function registerBubbleChart() {
	const {
		Chart,
		BubbleController,
		LinearScale,
		PointElement,
		Tooltip,
		Legend,
	} = await import('chart.js');

	Chart.register(BubbleController, LinearScale, PointElement, Tooltip, Legend);
	return Chart;
}
