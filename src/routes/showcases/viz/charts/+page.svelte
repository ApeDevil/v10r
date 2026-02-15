<script lang="ts">
	import { browser } from '$app/environment';
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives/table';
	import VizDemoCard from '../_components/VizDemoCard.svelte';
	import DataControls from '../_components/DataControls.svelte';
	import { BarChart, LineChart, AreaChart, PieChart, ScatterPlot, SimpleChart, RadarChart, BubbleChart, Sparkline, Gauge, Treemap } from '$lib/components/viz';
	import type { TreemapNode } from '$lib/components/viz/chart/treemap/types';
	import { getVizPalette } from '$lib/components/viz/_shared/theme-bridge';

	const sections = [
		{ id: 'simple-chart', label: 'Simple (SVG)' },
		{ id: 'bar-chart', label: 'Bar' },
		{ id: 'line-chart', label: 'Line' },
		{ id: 'area-chart', label: 'Area' },
		{ id: 'pie-chart', label: 'Pie' },
		{ id: 'scatter-plot', label: 'Scatter' },
		{ id: 'radar-chart', label: 'Radar' },
		{ id: 'bubble-chart', label: 'Bubble' },
		{ id: 'sparkline', label: 'Sparkline' },
		{ id: 'gauge', label: 'Gauge' },
		{ id: 'treemap', label: 'Treemap' },
	];

	// SSR-safe: resolve palette only in browser
	let palette: string[] = $state(browser ? getVizPalette() : []);

	// --- DataControls state ---
	let dataset: string = $state('sales');
	let animated: boolean = $state(true);

	const animationOption = $derived(animated ? {} : false);

	// --- Sample datasets ---

	type DatasetMap = {
		labels: string[];
		values: number[];
		values2?: number[];
		values3?: number[];
		pieLabels: string[];
		pieValues: number[];
		scatterA: { x: number; y: number }[];
		scatterB: { x: number; y: number }[];
		radarLabels: string[];
		radarValues: number[];
		radarValues2?: number[];
		bubbleData: { x: number; y: number; r: number }[];
		sparklineValues: number[];
		gaugeValue: number;
	};

	const datasets: Record<string, DatasetMap> = {
		sales: {
			labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
			values: [40, 65, 45, 80, 55, 70],
			values2: [30, 50, 60, 45, 70, 55],
			values3: [20, 35, 25, 40, 30, 45],
			pieLabels: ['Desktop', 'Mobile', 'Tablet', 'Other'],
			pieValues: [45, 35, 15, 5],
			scatterA: [
				{ x: 10, y: 20 }, { x: 25, y: 45 }, { x: 35, y: 30 },
				{ x: 45, y: 60 }, { x: 55, y: 40 }, { x: 65, y: 75 },
				{ x: 80, y: 55 }, { x: 90, y: 85 },
			],
			scatterB: [
				{ x: 15, y: 50 }, { x: 30, y: 25 }, { x: 40, y: 70 },
				{ x: 50, y: 35 }, { x: 60, y: 55 }, { x: 75, y: 45 },
				{ x: 85, y: 65 },
			],
			radarLabels: ['Design', 'Dev', 'Marketing', 'Sales', 'Support'],
			radarValues: [85, 70, 60, 90, 75],
			radarValues2: [65, 90, 80, 55, 70],
			bubbleData: [
				{ x: 20, y: 30, r: 10 }, { x: 40, y: 60, r: 18 },
				{ x: 60, y: 40, r: 8 }, { x: 80, y: 70, r: 14 },
				{ x: 30, y: 80, r: 12 }, { x: 70, y: 20, r: 16 },
			],
			sparklineValues: [40, 65, 45, 80, 55, 70, 60, 85],
			gaugeValue: 73,
		},
		traffic: {
			labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
			values: [120, 190, 150, 210, 180, 90],
			values2: [80, 110, 130, 160, 200, 220],
			values3: [30, 40, 35, 50, 45, 60],
			pieLabels: ['Organic', 'Direct', 'Social', 'Referral'],
			pieValues: [38, 28, 22, 12],
			scatterA: [
				{ x: 5, y: 30 }, { x: 20, y: 55 }, { x: 30, y: 40 },
				{ x: 50, y: 70 }, { x: 60, y: 50 }, { x: 70, y: 80 },
				{ x: 85, y: 60 }, { x: 95, y: 90 },
			],
			scatterB: [
				{ x: 10, y: 45 }, { x: 25, y: 30 }, { x: 45, y: 65 },
				{ x: 55, y: 40 }, { x: 65, y: 50 }, { x: 80, y: 70 },
				{ x: 90, y: 55 },
			],
			radarLabels: ['SEO', 'SEM', 'Social', 'Email', 'Content'],
			radarValues: [70, 85, 60, 45, 80],
			radarValues2: [55, 70, 90, 65, 50],
			bubbleData: [
				{ x: 15, y: 45, r: 14 }, { x: 35, y: 70, r: 10 },
				{ x: 55, y: 25, r: 20 }, { x: 75, y: 55, r: 8 },
				{ x: 45, y: 85, r: 16 }, { x: 85, y: 35, r: 12 },
			],
			sparklineValues: [120, 190, 150, 210, 180, 90, 160, 200],
			gaugeValue: 58,
		},
		performance: {
			labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
			values: [72, 85, 68, 91, 79, 88],
			values2: [65, 78, 82, 74, 90, 86],
			values3: [55, 60, 70, 65, 75, 80],
			pieLabels: ['Complete', 'In Progress', 'Pending', 'Failed'],
			pieValues: [62, 18, 12, 8],
			scatterA: [
				{ x: 12, y: 35 }, { x: 28, y: 50 }, { x: 38, y: 42 },
				{ x: 48, y: 68 }, { x: 58, y: 55 }, { x: 72, y: 78 },
				{ x: 82, y: 62 }, { x: 92, y: 88 },
			],
			scatterB: [
				{ x: 18, y: 48 }, { x: 32, y: 38 }, { x: 42, y: 72 },
				{ x: 52, y: 45 }, { x: 62, y: 60 }, { x: 78, y: 52 },
				{ x: 88, y: 70 },
			],
			radarLabels: ['Speed', 'Reliability', 'Scalability', 'Security', 'UX'],
			radarValues: [88, 75, 82, 90, 65],
			radarValues2: [72, 88, 68, 80, 85],
			bubbleData: [
				{ x: 25, y: 50, r: 16 }, { x: 50, y: 30, r: 12 },
				{ x: 70, y: 65, r: 10 }, { x: 35, y: 75, r: 18 },
				{ x: 85, y: 45, r: 14 }, { x: 55, y: 90, r: 8 },
			],
			sparklineValues: [72, 85, 68, 91, 79, 88, 82, 95],
			gaugeValue: 88,
		},
	};

	const d = $derived(datasets[dataset]);

	// --- SimpleChart data (static, not affected by dataset picker) ---

	const simpleData = $derived(
		d.labels.map((label, i) => ({ label, value: d.values[i] }))
	);

	// --- Chart.js data shapes ---

	const barData = $derived({
		labels: d.labels,
		datasets: [
			{
				label: 'Series A',
				data: d.values,
				backgroundColor: palette[0] || '#3b82f6',
				borderRadius: 4,
			},
		],
	});

	const groupedBarData = $derived({
		labels: d.labels.slice(0, 4),
		datasets: [
			{
				label: 'Series A',
				data: d.values.slice(0, 4),
				backgroundColor: palette[0] || '#3b82f6',
				borderRadius: 4,
			},
			{
				label: 'Series B',
				data: (d.values2 || d.values).slice(0, 4),
				backgroundColor: palette[3] || '#8b5cf6',
				borderRadius: 4,
			},
		],
	});

	const stackedBarData = $derived({
		labels: d.labels.slice(0, 4),
		datasets: [
			{
				label: 'Channel A',
				data: d.values.slice(0, 4),
				backgroundColor: palette[0] || '#3b82f6',
				borderRadius: 4,
			},
			{
				label: 'Channel B',
				data: (d.values2 || d.values).slice(0, 4),
				backgroundColor: palette[1] || '#10b981',
				borderRadius: 4,
			},
		],
	});

	const lineData = $derived({
		labels: d.labels,
		datasets: [
			{
				label: 'Primary',
				data: d.values,
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: 'transparent',
				tension: 0.3,
				pointRadius: 4,
				pointHoverRadius: 6,
			},
		],
	});

	const multiLineData = $derived({
		labels: d.labels,
		datasets: [
			{
				label: 'Series A',
				data: d.values,
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: 'transparent',
				tension: 0.3,
			},
			{
				label: 'Series B',
				data: d.values2 || d.values,
				borderColor: palette[1] || '#10b981',
				backgroundColor: 'transparent',
				tension: 0.3,
			},
			{
				label: 'Series C',
				data: d.values3 || d.values,
				borderColor: palette[2] || '#f59e0b',
				backgroundColor: 'transparent',
				tension: 0.3,
			},
		],
	});

	const areaData = $derived({
		labels: d.labels,
		datasets: [
			{
				label: 'Area',
				data: d.values,
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: (palette[0] || '#3b82f6') + '33',
				tension: 0.4,
				pointRadius: 3,
			},
		],
	});

	const pieData = $derived({
		labels: d.pieLabels,
		datasets: [
			{
				data: d.pieValues,
				backgroundColor: [
					palette[0] || '#3b82f6',
					palette[1] || '#10b981',
					palette[2] || '#f59e0b',
					palette[3] || '#8b5cf6',
				],
				borderWidth: 2,
				borderColor: 'var(--surface-1)',
			},
		],
	});

	const doughnutData = $derived({
		labels: d.pieLabels,
		datasets: [
			{
				data: d.pieValues,
				backgroundColor: [
					palette[1] || '#10b981',
					palette[2] || '#f59e0b',
					palette[5] || '#06b6d4',
					palette[4] || '#ef4444',
				],
				borderWidth: 2,
				borderColor: 'var(--surface-1)',
			},
		],
	});

	const scatterData = $derived({
		datasets: [
			{
				label: 'Dataset A',
				data: d.scatterA,
				backgroundColor: palette[0] || '#3b82f6',
				pointRadius: 5,
				pointHoverRadius: 7,
			},
			{
				label: 'Dataset B',
				data: d.scatterB,
				backgroundColor: palette[3] || '#8b5cf6',
				pointRadius: 5,
				pointHoverRadius: 7,
			},
		],
	});

	// --- Radar chart data ---

	const radarData = $derived({
		labels: d.radarLabels,
		datasets: [
			{
				label: 'Team A',
				data: d.radarValues,
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: (palette[0] || '#3b82f6') + '33',
				pointBackgroundColor: palette[0] || '#3b82f6',
			},
		],
	});

	const radarCompareData = $derived({
		labels: d.radarLabels,
		datasets: [
			{
				label: 'Team A',
				data: d.radarValues,
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: (palette[0] || '#3b82f6') + '33',
				pointBackgroundColor: palette[0] || '#3b82f6',
			},
			{
				label: 'Team B',
				data: d.radarValues2 || d.radarValues,
				borderColor: palette[3] || '#8b5cf6',
				backgroundColor: (palette[3] || '#8b5cf6') + '33',
				pointBackgroundColor: palette[3] || '#8b5cf6',
			},
		],
	});

	// --- Bubble chart data ---

	const bubbleData = $derived({
		datasets: [
			{
				label: 'Metrics',
				data: d.bubbleData,
				backgroundColor: (palette[0] || '#3b82f6') + '99',
				borderColor: palette[0] || '#3b82f6',
				borderWidth: 1,
			},
		],
	});

	// --- Sparkline table data ---

	const sparklineTable = $derived([
		{ label: 'Revenue', values: d.sparklineValues, type: 'line' as const },
		{ label: 'Orders', values: d.sparklineValues.map((v) => v * 0.8 + 10).map(Math.round), type: 'bar' as const },
		{ label: 'Visitors', values: d.sparklineValues.map((v) => v * 1.2 - 5).map(Math.round), type: 'area' as const },
	]);

	// --- Treemap data (static, not dataset-dependent) ---

	const treemapFlat: TreemapNode = {
		id: 'root',
		label: 'Budget',
		children: [
			{ id: 'eng', label: 'Engineering', value: 450 },
			{ id: 'mkt', label: 'Marketing', value: 280 },
			{ id: 'ops', label: 'Operations', value: 180 },
			{ id: 'design', label: 'Design', value: 150 },
			{ id: 'hr', label: 'HR', value: 90 },
			{ id: 'legal', label: 'Legal', value: 60 },
		],
	};

	const treemapNested: TreemapNode = {
		id: 'root',
		label: 'Company',
		children: [
			{
				id: 'eng',
				label: 'Engineering',
				children: [
					{ id: 'frontend', label: 'Frontend', value: 180 },
					{ id: 'backend', label: 'Backend', value: 200 },
					{ id: 'infra', label: 'Infra', value: 70 },
				],
			},
			{
				id: 'product',
				label: 'Product',
				children: [
					{ id: 'design', label: 'Design', value: 120 },
					{ id: 'research', label: 'Research', value: 80 },
				],
			},
			{
				id: 'gtm',
				label: 'Go-to-Market',
				children: [
					{ id: 'sales', label: 'Sales', value: 160 },
					{ id: 'marketing', label: 'Marketing', value: 140 },
					{ id: 'support', label: 'Support', value: 60 },
				],
			},
		],
	};
</script>

<svelte:head>
	<title>Charts - Viz Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Charts"
		description="Bar, line, area, pie, scatter, radar, bubble, sparkline, gauge, and treemap charts. SimpleChart and Sparkline/Gauge are zero-dependency SVG. The rest use Chart.js or d3-hierarchy."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz', href: '/showcases/viz' },
			{ label: 'Charts' }
		]}
	/>

	<SectionNav {sections} />

	<DataControls bind:dataset bind:animated />

	<main class="content">
		<!-- Simple Chart (zero-dep SVG) -->
		<section id="simple-chart" class="section">
			<h2 class="section-title">Simple Chart (SVG, Zero Dependencies)</h2>
			<p class="section-description">Built-in SVG chart with no external dependencies. Supports bar, line, and area types.</p>

			<div class="demos">
				<VizDemoCard
					title="Bar"
					description="Simple SVG bar chart with category data."
				>
					{#snippet visualization()}
						<SimpleChart type="bar" data={simpleData} width={500} height={280} />
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Line"
					description="Simple SVG line chart with trend data."
				>
					{#snippet visualization()}
						<SimpleChart type="line" data={simpleData} width={500} height={280} />
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Area"
					description="Simple SVG area chart showing magnitude."
				>
					{#snippet visualization()}
						<SimpleChart type="area" data={simpleData} width={500} height={280} />
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Bar Chart (Chart.js) -->
		<section id="bar-chart" class="section">
			<h2 class="section-title">Bar Chart</h2>
			<p class="section-description">Chart.js bar charts with tree-shaken imports. Vertical, grouped, and stacked variants.</p>

			<div class="demos">
				<VizDemoCard
					title="Vertical Bars"
					description="Standard column chart for comparing categories."
				>
					{#snippet visualization()}
						<BarChart data={barData} options={{ animation: animationOption }} ariaLabel="Monthly sales bar chart" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Label</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.labels as label, i}
									<Row>
										<Cell>{label}</Cell>
										<Cell>{d.values[i]}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<BarChart
  data={{
    labels: ['Jan', 'Feb', ...],
    datasets: [{
      label: 'Series A',
      data: [40, 65, 45, 80, 55, 70],
      backgroundColor: palette[0],
      borderRadius: 4,
    }],
  }}
  ariaLabel="Monthly sales bar chart"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Grouped Bars"
					description="Multi-series comparison across categories."
				>
					{#snippet visualization()}
						<BarChart data={groupedBarData} options={{ animation: animationOption }} ariaLabel="Quarterly comparison bar chart" />
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Stacked Bars"
					description="Part-to-whole composition across categories."
				>
					{#snippet visualization()}
						<BarChart
							data={stackedBarData}
							options={{ scales: { x: { stacked: true }, y: { stacked: true } }, animation: animationOption }}
							ariaLabel="Stacked product sales chart"
						/>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Horizontal Bars"
					description="Horizontal bar chart for ranking data."
				>
					{#snippet visualization()}
						<BarChart data={barData} horizontal options={{ animation: animationOption }} ariaLabel="Horizontal sales chart" />
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Line Chart (Chart.js) -->
		<section id="line-chart" class="section">
			<h2 class="section-title">Line Chart</h2>
			<p class="section-description">Chart.js line charts for trends and comparisons.</p>

			<div class="demos">
				<VizDemoCard
					title="Single Line"
					description="Revenue trend over time."
				>
					{#snippet visualization()}
						<LineChart data={lineData} options={{ animation: animationOption }} ariaLabel="Revenue trend line chart" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Label</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.labels as label, i}
									<Row>
										<Cell>{label}</Cell>
										<Cell>{d.values[i]}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Multi-Line"
					description="Compare multiple series across the same timeline."
				>
					{#snippet visualization()}
						<LineChart data={multiLineData} options={{ animation: animationOption }} ariaLabel="Device traffic comparison" />
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Area Chart (Chart.js) -->
		<section id="area-chart" class="section">
			<h2 class="section-title">Area Chart</h2>
			<p class="section-description">Filled line charts showing magnitude and trends.</p>

			<div class="demos">
				<VizDemoCard
					title="Filled Area"
					description="User growth shown as filled area."
				>
					{#snippet visualization()}
						<AreaChart data={areaData} options={{ animation: animationOption }} ariaLabel="User growth area chart" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Label</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.labels as label, i}
									<Row>
										<Cell>{label}</Cell>
										<Cell>{d.values[i]}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Pie Chart (Chart.js) -->
		<section id="pie-chart" class="section">
			<h2 class="section-title">Pie Chart</h2>
			<p class="section-description">Pie and doughnut charts for part-to-whole relationships.</p>

			<div class="demos">
				<VizDemoCard
					title="Pie"
					description="Device type market share."
				>
					{#snippet visualization()}
						<PieChart data={pieData} options={{ animation: animationOption }} ariaLabel="Device market share pie chart" class="max-w-sm" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Category</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.pieLabels as label, i}
									<Row>
										<Cell>{label}</Cell>
										<Cell>{d.pieValues[i]}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Doughnut"
					description="Task status distribution."
				>
					{#snippet visualization()}
						<PieChart data={doughnutData} doughnut options={{ animation: animationOption }} ariaLabel="Task status doughnut chart" class="max-w-sm" />
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Scatter Plot (Chart.js) -->
		<section id="scatter-plot" class="section">
			<h2 class="section-title">Scatter Plot</h2>
			<p class="section-description">Chart.js scatter plots for correlation analysis.</p>

			<div class="demos">
				<VizDemoCard
					title="Two Datasets"
					description="Comparing distributions across two groups."
				>
					{#snippet visualization()}
						<ScatterPlot data={scatterData} options={{ animation: animationOption }} ariaLabel="Two-dataset scatter plot" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Dataset</HeaderCell>
									<HeaderCell>X</HeaderCell>
									<HeaderCell>Y</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.scatterA as point}
									<Row>
										<Cell>A</Cell>
										<Cell>{point.x}</Cell>
										<Cell>{point.y}</Cell>
									</Row>
								{/each}
								{#each d.scatterB as point}
									<Row>
										<Cell>B</Cell>
										<Cell>{point.x}</Cell>
										<Cell>{point.y}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Radar Chart (Chart.js) -->
		<section id="radar-chart" class="section">
			<h2 class="section-title">Radar Chart</h2>
			<p class="section-description">Chart.js radar charts for multi-dimensional comparisons. Uses radial scales instead of Cartesian axes.</p>

			<div class="demos">
				<VizDemoCard
					title="Skill Profile"
					description="Single-series radar showing team strengths."
				>
					{#snippet visualization()}
						<RadarChart data={radarData} options={{ animation: animationOption }} ariaLabel="Team skill profile radar chart" class="max-w-md" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Dimension</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.radarLabels as label, i}
									<Row>
										<Cell>{label}</Cell>
										<Cell>{d.radarValues[i]}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<RadarChart
  data={{
    labels: ['Design', 'Dev', ...],
    datasets: [{
      label: 'Team A',
      data: [85, 70, 60, 90, 75],
      borderColor: palette[0],
      backgroundColor: palette[0] + '33',
    }],
  }}
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Comparison"
					description="Two-series radar for head-to-head comparison."
				>
					{#snippet visualization()}
						<RadarChart data={radarCompareData} options={{ animation: animationOption }} ariaLabel="Team comparison radar chart" class="max-w-md" />
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Bubble Chart (Chart.js) -->
		<section id="bubble-chart" class="section">
			<h2 class="section-title">Bubble Chart</h2>
			<p class="section-description">Chart.js bubble charts for multi-variable analysis. Each point encodes x, y position and radius as a third variable.</p>

			<div class="demos">
				<VizDemoCard
					title="Multi-Variable"
					description="Three dimensions encoded as position and size."
				>
					{#snippet visualization()}
						<BubbleChart data={bubbleData} options={{ animation: animationOption }} ariaLabel="Multi-variable bubble chart" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>X</HeaderCell>
									<HeaderCell>Y</HeaderCell>
									<HeaderCell>Size</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each d.bubbleData as point}
									<Row>
										<Cell>{point.x}</Cell>
										<Cell>{point.y}</Cell>
										<Cell>{point.r}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<BubbleChart
  data={{
    datasets: [{
      label: 'Metrics',
      data: [
        { x: 20, y: 30, r: 10 },
        { x: 40, y: 60, r: 18 },
      ],
      backgroundColor: palette[0] + '99',
    }],
  }}
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Sparkline (Pure SVG) -->
		<section id="sparkline" class="section">
			<h2 class="section-title">Sparkline</h2>
			<p class="section-description">Lightweight inline micro-charts. Pure SVG, zero dependencies. Ideal for embedding in tables and dashboards.</p>

			<div class="demos">
				<VizDemoCard
					title="Inline Sparklines"
					description="Line, bar, and area sparklines embedded in a table."
				>
					{#snippet visualization()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Metric</HeaderCell>
									<HeaderCell>Current</HeaderCell>
									<HeaderCell>Trend</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each sparklineTable as row}
									<Row>
										<Cell>{row.label}</Cell>
										<Cell>{row.values[row.values.length - 1]}</Cell>
										<Cell>
											<Sparkline
												data={row.values}
												type={row.type}
												width={100}
												height={28}
												ariaLabel="{row.label} trend"
											/>
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<Sparkline
  data={[40, 65, 45, 80, 55, 70]}
  type="line"
  width={100}
  height={28}
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Gauge (Pure SVG) -->
		<section id="gauge" class="section">
			<h2 class="section-title">Gauge</h2>
			<p class="section-description">Single-value radial meters. Pure SVG, zero dependencies. 270-degree arc sweep with optional color segments.</p>

			<div class="demos">
				<VizDemoCard
					title="Simple Gauge"
					description="Basic gauge with value and label."
				>
					{#snippet visualization()}
						<div class="gauge-row">
							<Gauge value={d.gaugeValue} label="Score" />
						</div>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<Gauge
  value={73}
  label="Score"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Segmented Gauge"
					description="Color zones indicate performance ranges."
				>
					{#snippet visualization()}
						<div class="gauge-row">
							<Gauge
								value={d.gaugeValue}
								label="Health"
								segments={[
									{ from: 0, to: 40, color: '#ef4444' },
									{ from: 40, to: 70, color: '#f59e0b' },
									{ from: 70, to: 100, color: '#10b981' },
								]}
							/>
						</div>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Mini Gauges"
					description="Compact gauges for dashboard rows."
				>
					{#snippet visualization()}
						<div class="gauge-row">
							<Gauge value={92} label="CPU" size={100} strokeWidth={8} />
							<Gauge value={67} label="Memory" size={100} strokeWidth={8} />
							<Gauge value={34} label="Disk" size={100} strokeWidth={8} />
						</div>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Treemap (d3-hierarchy) -->
		<section id="treemap" class="section">
			<h2 class="section-title">Treemap</h2>
			<p class="section-description">Nested rectangles showing hierarchical data proportions. Uses d3-hierarchy for layout. Click to zoom into nested categories.</p>

			<div class="demos">
				<VizDemoCard
					title="Flat Treemap"
					description="Department budget allocation."
				>
					{#snippet visualization()}
						<Treemap data={treemapFlat} ariaLabel="Department budget treemap" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Department</HeaderCell>
									<HeaderCell>Budget (k)</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each treemapFlat.children ?? [] as dept}
									<Row>
										<Cell>{dept.label}</Cell>
										<Cell>{dept.value}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<Treemap
  data={{
    id: 'root',
    label: 'Budget',
    children: [
      { id: 'eng', label: 'Engineering', value: 450 },
      { id: 'mkt', label: 'Marketing', value: 280 },
      ...
    ],
  }}
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Nested with Zoom"
					description="Click a category to drill down. Use breadcrumbs to navigate back."
				>
					{#snippet visualization()}
						<Treemap data={treemapNested} ariaLabel="Company org treemap with zoom" />
					{/snippet}
				</VizDemoCard>
			</div>
		</section>
	</main>

	<BackLink href="/showcases/viz" label="Viz" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.content {
		padding-top: var(--spacing-7);
	}

	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.gauge-row {
		display: flex;
		gap: var(--spacing-6);
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
