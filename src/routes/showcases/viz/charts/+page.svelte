<script lang="ts">
	import { browser } from '$app/environment';
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
	import VizDemoCard from '../_components/VizDemoCard.svelte';
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

	// --- Sample data ---

	const simpleData = [
		{ label: 'Jan', value: 40 },
		{ label: 'Feb', value: 65 },
		{ label: 'Mar', value: 45 },
		{ label: 'Apr', value: 80 },
		{ label: 'May', value: 55 },
		{ label: 'Jun', value: 70 },
	];

	const barData = $derived({
		labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
		datasets: [
			{
				label: 'Sales',
				data: [40, 65, 45, 80, 55, 70],
				backgroundColor: palette[0] || '#3b82f6',
				borderRadius: 4,
			},
		],
	});

	const groupedBarData = $derived({
		labels: ['Q1', 'Q2', 'Q3', 'Q4'],
		datasets: [
			{
				label: '2024',
				data: [120, 190, 150, 210],
				backgroundColor: palette[0] || '#3b82f6',
				borderRadius: 4,
			},
			{
				label: '2025',
				data: [140, 170, 180, 240],
				backgroundColor: palette[3] || '#8b5cf6',
				borderRadius: 4,
			},
		],
	});

	const stackedBarData = $derived({
		labels: ['Product A', 'Product B', 'Product C', 'Product D'],
		datasets: [
			{
				label: 'Online',
				data: [65, 45, 80, 55],
				backgroundColor: palette[0] || '#3b82f6',
				borderRadius: 4,
			},
			{
				label: 'Retail',
				data: [35, 55, 20, 45],
				backgroundColor: palette[1] || '#10b981',
				borderRadius: 4,
			},
		],
	});

	const lineData = $derived({
		labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
		datasets: [
			{
				label: 'Revenue',
				data: [30, 45, 38, 65, 55, 72, 68, 80],
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: 'transparent',
				tension: 0.3,
				pointRadius: 4,
				pointHoverRadius: 6,
			},
		],
	});

	const multiLineData = $derived({
		labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		datasets: [
			{
				label: 'Desktop',
				data: [120, 190, 150, 210, 180, 90, 60],
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: 'transparent',
				tension: 0.3,
			},
			{
				label: 'Mobile',
				data: [80, 110, 130, 160, 200, 220, 180],
				borderColor: palette[1] || '#10b981',
				backgroundColor: 'transparent',
				tension: 0.3,
			},
			{
				label: 'Tablet',
				data: [30, 40, 35, 50, 45, 60, 55],
				borderColor: palette[2] || '#f59e0b',
				backgroundColor: 'transparent',
				tension: 0.3,
			},
		],
	});

	const areaData = $derived({
		labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
		datasets: [
			{
				label: 'Users',
				data: [200, 350, 280, 450, 520, 610],
				borderColor: palette[0] || '#3b82f6',
				backgroundColor: (palette[0] || '#3b82f6') + '33',
				tension: 0.4,
				pointRadius: 3,
			},
		],
	});

	const pieData = $derived({
		labels: ['Desktop', 'Mobile', 'Tablet', 'Other'],
		datasets: [
			{
				data: [45, 35, 15, 5],
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
		labels: ['Complete', 'In Progress', 'Pending', 'Failed'],
		datasets: [
			{
				data: [62, 18, 12, 8],
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
				data: [
					{ x: 10, y: 20 }, { x: 25, y: 45 }, { x: 35, y: 30 },
					{ x: 45, y: 60 }, { x: 55, y: 40 }, { x: 65, y: 75 },
					{ x: 80, y: 55 }, { x: 90, y: 85 },
				],
				backgroundColor: palette[0] || '#3b82f6',
				pointRadius: 5,
				pointHoverRadius: 7,
			},
			{
				label: 'Dataset B',
				data: [
					{ x: 15, y: 50 }, { x: 30, y: 25 }, { x: 40, y: 70 },
					{ x: 50, y: 35 }, { x: 60, y: 55 }, { x: 75, y: 45 },
					{ x: 85, y: 65 },
				],
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
						<BarChart data={barData} ariaLabel="Monthly sales bar chart" />
					{/snippet}
					{#snippet code()}
						<pre><code>{`<BarChart
  data={{
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Sales',
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
						<BarChart data={groupedBarData} ariaLabel="Quarterly comparison bar chart" />
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Stacked Bars"
					description="Part-to-whole composition across categories."
				>
					{#snippet visualization()}
						<BarChart
							data={stackedBarData}
							options={{ scales: { x: { stacked: true }, y: { stacked: true } } }}
							ariaLabel="Stacked product sales chart"
						/>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Horizontal Bars"
					description="Horizontal bar chart for ranking data."
				>
					{#snippet visualization()}
						<BarChart data={barData} horizontal ariaLabel="Horizontal sales chart" />
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
						<LineChart data={lineData} ariaLabel="Revenue trend line chart" />
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Multi-Line"
					description="Compare multiple series across the same timeline."
				>
					{#snippet visualization()}
						<LineChart data={multiLineData} ariaLabel="Device traffic comparison" />
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
						<AreaChart data={areaData} ariaLabel="User growth area chart" />
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
						<PieChart data={pieData} ariaLabel="Device market share pie chart" class="max-w-sm" />
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Doughnut"
					description="Task status distribution."
				>
					{#snippet visualization()}
						<PieChart data={doughnutData} doughnut ariaLabel="Task status doughnut chart" class="max-w-sm" />
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
						<ScatterPlot data={scatterData} ariaLabel="Two-dataset scatter plot" />
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
