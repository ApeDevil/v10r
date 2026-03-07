<script lang="ts">
	import { Alert } from '$lib/components/composites';
	import FunnelChart from '../_components/FunnelChart.svelte';
	import DateRangePresets from '../_components/DateRangePresets.svelte';
	import ChartSection from '../_components/ChartSection.svelte';
	import QueryTime from '../_components/QueryTime.svelte';

	let { data } = $props();

	const overallConversion = $derived(
		data.funnel.length >= 2
			? Math.round((data.funnel[data.funnel.length - 1].count / data.funnel[0].count) * 100)
			: 0,
	);
</script>

{#if data.error}
	<Alert variant="error" title="Database Error">
		<code>{data.error}</code>
	</Alert>
{/if}

<div class="funnels-layout">
	<div class="funnels-controls">
		<DateRangePresets defaultRange="90" />
		<div class="funnels-meta">
			{#if data.queryMs}
				<QueryTime ms={data.queryMs} />
			{/if}
		</div>
	</div>

	{#if data.funnel.length > 0}
		<div class="conversion-banner">
			<span class="conversion-label">Overall Conversion</span>
			<span class="conversion-value">{overallConversion}%</span>
			<span class="conversion-detail">
				{data.funnel[0].count.toLocaleString()} visitors
				&rarr;
				{data.funnel[data.funnel.length - 1].count.toLocaleString()} signups
			</span>
		</div>

		<ChartSection
			title="Landing &rarr; Signup Funnel"
			description="Tracks visitors from landing page through docs and pricing to signup"
			details="Each step counts distinct sessions that visited that page. Drop-off percentages show how many visitors left between steps. Data comes from raw pageview events with session-level deduplication."
		>
			{#snippet chart()}
				<FunnelChart steps={data.funnel} />
			{/snippet}
		</ChartSection>

		<!-- Step details table -->
		<ChartSection title="Step Breakdown" description="Detailed metrics for each funnel step">
			{#snippet chart()}
				<table class="funnel-table" aria-label="Funnel step breakdown">
					<thead>
						<tr>
							<th scope="col">Step</th>
							<th scope="col">Path</th>
							<th scope="col" class="numeric">Sessions</th>
							<th scope="col" class="numeric">Rate</th>
							<th scope="col" class="numeric">Drop-off</th>
						</tr>
					</thead>
					<tbody>
						{#each data.funnel as step, i}
							{@const prev = i > 0 ? data.funnel[i - 1].count : step.count}
							{@const dropoff = i > 0 ? prev - step.count : 0}
							{@const dropPct = prev > 0 ? Math.round((dropoff / prev) * 100) : 0}
							<tr>
								<td class="step-label">{step.label}</td>
								<td><code>{step.path}</code></td>
								<td class="numeric">{step.count.toLocaleString()}</td>
								<td class="numeric">{step.rate}%</td>
								<td class="numeric dropoff">
									{#if i > 0}
										-{dropoff.toLocaleString()} ({dropPct}%)
									{:else}
										—
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/snippet}
		</ChartSection>
	{:else if !data.error}
		<Alert variant="info" title="No funnel data">
			<p>No funnel data found for the selected range. Try reseeding the analytics data from the Overview page.</p>
		</Alert>
	{/if}
</div>

<style>
	.funnels-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.funnels-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.funnels-meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
	}

	.conversion-banner {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
		padding: var(--spacing-5) var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
	}

	.conversion-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
	}

	.conversion-value {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}

	.conversion-detail {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.funnel-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.funnel-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
	}

	.funnel-table th.numeric,
	.funnel-table td.numeric {
		text-align: right;
	}

	.funnel-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}

	.funnel-table .step-label {
		font-weight: 600;
	}

	.funnel-table .dropoff {
		color: var(--color-error);
	}
</style>
