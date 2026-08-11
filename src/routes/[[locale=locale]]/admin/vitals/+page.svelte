<script lang="ts">
import { Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Skeleton } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const ranges = [
	{ value: '7', label: '7d' },
	{ value: '30', label: '30d' },
	{ value: '90', label: '90d' },
];
</script>

<Stack gap="6">
	<Cluster justify="between" align="center">
		<h1 class="text-fluid-2xl font-semibold">{m.admin_vitals_title()}</h1>
		<div class="filter-bar">
			{#each ranges as r (r.value)}
				<a
					href="/admin/vitals?range={r.value}"
					class="filter-link"
					class:active={data.range === r.value}
					aria-current={data.range === r.value ? 'page' : undefined}
				>
					{r.label}
				</a>
			{/each}
		</div>
	</Cluster>

	<!-- p75 per metric, with the element most often to blame -->
	<Card>
		{#await data.vitals}
			<Skeleton variant="rectangular" height="120px" />
		{:then vitals}
			{#if vitals.length === 0}
				<p class="text-muted text-fluid-sm">{m.admin_vitals_empty()}</p>
			{:else}
				<div class="vitals-grid">
					{#each vitals as v (v.metric)}
						<div class="vital-card">
							<span class="stat-label">{v.metric}</span>
							<span class="stat-value">{v.metric === 'CLS' ? v.p75 : `${Math.round(v.p75)}ms`}</span>
							<span class="vital-meta">{m.admin_vitals_samples({ count: v.samples })}</span>
							{#if v.worstTarget}
								<span class="vital-meta">
									{m.admin_vitals_blame()}: <code>{v.worstTarget}</code>
								</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:catch}
			<p class="text-muted text-fluid-sm">{m.admin_vitals_empty()}</p>
		{/await}
	</Card>
</Stack>

<style>
	.filter-bar {
		display: flex;
		gap: var(--spacing-1);
	}

	.filter-link {
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		text-decoration: none;
	}

	.filter-link.active {
		background: var(--color-fg);
		color: var(--color-bg);
	}

	.vitals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: var(--spacing-4);
	}

	.vital-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		min-width: 0;
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.vital-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
