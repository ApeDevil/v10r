<script lang="ts">
	import { browser } from '$app/environment';
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives/table';
	import VizDemoCard from '../_components/VizDemoCard.svelte';
	import DataControls from '../_components/DataControls.svelte';
	import { BarChart, LineChart, AreaChart, PieChart, ScatterPlot, SimpleChart } from '$lib/components/viz';
	import { getVizPalette } from '$lib/components/viz/_shared/theme-bridge';

	const sections = [
		{ id: 'simple-chart', label: 'Simple (SVG)' },
		{ id: 'bar-chart', label: 'Bar' },
		{ id: 'line-chart', label: 'Line' },
		{ id: 'area-chart', label: 'Area' },
		{ id: 'pie-chart', label: 'Pie' },
		{ id: 'scatter-plot', label: 'Scatter' },
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
</script>

<svelte:head>
	<title>Charts - Viz Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Charts"
		description="Bar, line, area, pie, and scatter charts. SimpleChart is zero-dependency SVG. The rest use Chart.js with tree-shaken imports."
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
