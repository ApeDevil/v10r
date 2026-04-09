<script lang="ts">
import { browser } from '$app/environment';
import { BackLink, NavSection, PageHeader } from '$lib/components/composites';
import { Body, Cell, Header, HeaderCell, Row, Table } from '$lib/components/primitives/table';
import { HeatMap, ScatterPlot } from '$lib/components/viz';
import { getVizPalette } from '$lib/components/viz/_shared/theme-bridge';
import type { HeatMapData } from '$lib/components/viz/plot';
import VizDemoCard from '../_components/VizDemoCard.svelte';

const sections = [
	{ id: 'scatter-plot', label: 'Scatter' },
	{ id: 'activity-heatmap', label: 'Activity' },
	{ id: 'correlation-matrix', label: 'Correlation' },
	{ id: 'server-load', label: 'Server Load' },
];

// SSR-safe: resolve palette only in browser
let palette: string[] = $state(browser ? getVizPalette() : []);

// --- Scatter Plot data ---

const scatterData = {
	datasets: [
		{
			label: 'Dataset A',
			data: [
				{ x: 10, y: 20 },
				{ x: 25, y: 45 },
				{ x: 35, y: 30 },
				{ x: 45, y: 60 },
				{ x: 55, y: 40 },
				{ x: 65, y: 75 },
				{ x: 80, y: 55 },
				{ x: 90, y: 85 },
			],
			backgroundColor: palette[0] || '#3b82f6',
			pointRadius: 5,
			pointHoverRadius: 7,
		},
		{
			label: 'Dataset B',
			data: [
				{ x: 15, y: 50 },
				{ x: 30, y: 25 },
				{ x: 40, y: 70 },
				{ x: 50, y: 35 },
				{ x: 60, y: 55 },
				{ x: 75, y: 45 },
				{ x: 85, y: 65 },
			],
			backgroundColor: palette[3] || '#8b5cf6',
			pointRadius: 5,
			pointHoverRadius: 7,
		},
	],
};

// --- Activity Heatmap (GitHub-style contribution graph) ---

const activityData: HeatMapData = {
	xLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
	yLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
	values: [
		[3, 5, 1, 8, 2, 6, 4, 7, 3, 9, 5, 2],
		[6, 2, 7, 4, 9, 1, 5, 3, 8, 2, 7, 4],
		[1, 8, 3, 6, 4, 7, 2, 9, 1, 5, 3, 8],
		[4, 3, 9, 2, 7, 5, 8, 1, 6, 4, 9, 3],
		[7, 6, 2, 5, 1, 8, 3, 4, 7, 6, 2, 5],
		[2, 1, 4, 3, 6, 2, 1, 5, 2, 3, 1, 6],
		[1, 0, 2, 1, 3, 1, 0, 2, 1, 1, 0, 3],
	],
};

// --- Correlation Matrix ---

const corrLabels = ['Sales', 'Traffic', 'Ads', 'Social', 'Email', 'SEO'];
const corrData: HeatMapData = {
	xLabels: corrLabels,
	yLabels: corrLabels,
	values: [
		[1.0, 0.85, 0.72, 0.45, 0.63, 0.78],
		[0.85, 1.0, 0.65, 0.58, 0.51, 0.82],
		[0.72, 0.65, 1.0, 0.38, 0.71, 0.55],
		[0.45, 0.58, 0.38, 1.0, 0.42, 0.35],
		[0.63, 0.51, 0.71, 0.42, 1.0, 0.6],
		[0.78, 0.82, 0.55, 0.35, 0.6, 1.0],
	],
};

// --- Server Load (2-hour blocks × days) ---

const serverData: HeatMapData = {
	xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
	yLabels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
	values: [
		[12, 15, 10, 14, 11, 8, 6],
		[8, 10, 7, 9, 8, 5, 4],
		[5, 6, 4, 5, 4, 3, 3],
		[15, 18, 14, 17, 16, 7, 5],
		[45, 52, 48, 50, 47, 12, 10],
		[78, 85, 80, 82, 75, 25, 18],
		[92, 95, 88, 90, 85, 35, 22],
		[88, 90, 85, 87, 82, 30, 20],
		[95, 98, 92, 96, 90, 28, 18],
		[72, 78, 70, 75, 68, 20, 15],
		[42, 48, 40, 45, 38, 18, 12],
		[20, 25, 18, 22, 17, 10, 8],
	],
};
</script>

<svelte:head>
	<title>Plots - Viz Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Plots"
		description="Scatter plots and heatmaps for dense data visualization. ScatterPlot uses Chart.js; HeatMap is zero-dependency pure Canvas with ResizeObserver, DPI scaling, and design token theming."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz', href: '/showcases/viz' },
			{ label: 'Plots' },
		]}
	/>

	<NavSection {sections} />

	<main class="content">
		<!-- Scatter Plot -->
		<section id="scatter-plot" class="section">
			<h2 class="section-title">Scatter Plot</h2>
			<p class="section-description">Chart.js scatter plots for correlation analysis. Each dataset renders as a distinct point cloud.</p>

			<div class="demos">
				<VizDemoCard
					title="Two Datasets"
					description="Comparing distributions across two groups."
				>
					{#snippet visualization()}
						<ScatterPlot data={scatterData} ariaLabel="Two-dataset scatter plot" />
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
								{#each scatterData.datasets[0].data as point}
									<Row>
										<Cell>A</Cell>
										<Cell>{point.x}</Cell>
										<Cell>{point.y}</Cell>
									</Row>
								{/each}
								{#each scatterData.datasets[1].data as point}
									<Row>
										<Cell>B</Cell>
										<Cell>{point.x}</Cell>
										<Cell>{point.y}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<ScatterPlot
  data={{
    datasets: [
      { label: 'A', data: [{ x: 10, y: 20 }, ...], backgroundColor: palette[0] },
      { label: 'B', data: [{ x: 15, y: 50 }, ...], backgroundColor: palette[3] },
    ],
  }}
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Activity Heatmap -->
		<section id="activity-heatmap" class="section">
			<h2 class="section-title">Activity Heatmap</h2>
			<p class="section-description">GitHub-style contribution graph showing activity intensity across days and weeks. Green color scale for growth/activity data.</p>

			<div class="demos">
				<VizDemoCard
					title="Weekly Activity"
					description="Contributions per day across 12 weeks."
				>
					{#snippet visualization()}
						<HeatMap
							data={activityData}
							colorRange={['#e5e7eb', '#22c55e']}
							ariaLabel="Weekly activity heatmap showing contributions per day"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Day</HeaderCell>
									{#each activityData.xLabels as week}
										<HeaderCell>{week}</HeaderCell>
									{/each}
								</Row>
							</Header>
							<Body>
								{#each activityData.yLabels as day, r}
									<Row>
										<Cell>{day}</Cell>
										{#each activityData.values[r] as val}
											<Cell>{val}</Cell>
										{/each}
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<HeatMap
  data={{
    xLabels: ['W1', 'W2', ...],
    yLabels: ['Mon', 'Tue', ...],
    values: [[3, 5, 1, ...], ...],
  }}
  colorRange={['#e5e7eb', '#22c55e']}
  ariaLabel="Weekly activity heatmap"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Correlation Matrix -->
		<section id="correlation-matrix" class="section">
			<h2 class="section-title">Correlation Matrix</h2>
			<p class="section-description">Symmetric correlation matrix with numeric values displayed inside cells. Uses the default chart color scale.</p>

			<div class="demos">
				<VizDemoCard
					title="Channel Correlations"
					description="Pairwise correlation coefficients between marketing channels."
				>
					{#snippet visualization()}
						<HeatMap
							data={corrData}
							showValues
							formatValue={(v) => v.toFixed(2)}
							aspect="square"
							ariaLabel="Marketing channel correlation matrix"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>{' '}</HeaderCell>
									{#each corrLabels as label}
										<HeaderCell>{label}</HeaderCell>
									{/each}
								</Row>
							</Header>
							<Body>
								{#each corrLabels as label, r}
									<Row>
										<Cell>{label}</Cell>
										{#each corrData.values[r] as val}
											<Cell>{val.toFixed(2)}</Cell>
										{/each}
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Server Load -->
		<section id="server-load" class="section">
			<h2 class="section-title">Server Load</h2>
			<p class="section-description">Response time heatmap showing server load patterns across time of day and day of week. Red color scale for alert-level data.</p>

			<div class="demos">
				<VizDemoCard
					title="Response Times (ms)"
					description="Average server response time in 2-hour blocks."
				>
					{#snippet visualization()}
						<HeatMap
							data={serverData}
							colorRange={['#fef2f2', '#ef4444']}
							formatValue={(v) => `${v}ms`}
							ariaLabel="Server response time heatmap"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Time</HeaderCell>
									{#each serverData.xLabels as day}
										<HeaderCell>{day}</HeaderCell>
									{/each}
								</Row>
							</Header>
							<Body>
								{#each serverData.yLabels as time, r}
									<Row>
										<Cell>{time}</Cell>
										{#each serverData.values[r] as val}
											<Cell>{val}</Cell>
										{/each}
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
