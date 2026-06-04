<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';

let { data } = $props();

// Compact per-provider headroom for the glance strip; full board on the Models tab.
const resourceById = $derived(new Map(data.resources.map((r) => [r.id, r])));
</script>
<Stack gap="6">
	<!-- AI activity KPIs -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">AI Overview</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		<div class="stat-grid">
			<div class="stat-card">
				<span class="stat-label">Total Conversations</span>
				<span class="stat-value">{data.ai.totalConversations.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Total Messages</span>
				<span class="stat-value">{data.ai.totalMessages.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Conversations Today</span>
				<span class="stat-value">{data.ai.conversationsToday.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Messages Today</span>
				<span class="stat-value">{data.ai.messagesToday.toLocaleString()}</span>
			</div>
		</div>
	</Card>

	<!-- Provider health (summary — full routing detail on the Models tab) -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Providers</h2>
				<a class="tab-link" href={localizeHref('/admin/ai/models')}>Models &rarr;</a>
			</Cluster>
		{/snippet}

		<div class="provider-list">
			{#each data.providers as provider}
				{@const res = resourceById.get(provider.id)}
				<div class="provider-row">
					<Cluster gap="2" align="center">
						<span class="health-dot health-dot--{provider.configured ? 'success' : 'secondary'}"></span>
						<span class="provider-name">{provider.name}</span>
						{#if data.activeProvider?.id === provider.id}
							<Badge variant="success">Active</Badge>
						{/if}
					</Cluster>
					<Cluster gap="3" align="center">
						{#if provider.configured && res}
							{#if res.cooledDown}
								<Badge variant="warning">Cooling</Badge>
							{:else if res.remaining !== null}
								<span class="headroom">~{res.remaining.toLocaleString()} left <span class="est">est.</span></span>
							{:else}
								<span class="headroom muted">no daily cap</span>
							{/if}
						{/if}
						<code class="provider-model">{provider.model}</code>
						<Badge variant={provider.configured ? 'success' : 'secondary'}>
							{provider.configured ? 'Configured' : 'Not configured'}
						</Badge>
					</Cluster>
				</div>
			{/each}
		</div>
	</Card>

	<!-- nRAG corpus (summary — full management on the nRAG tab) -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">nRAG Corpus</h2>
				<a class="tab-link" href={localizeHref('/admin/ai/nrag')}>nRAG &rarr;</a>
			</Cluster>
		{/snippet}

		<div class="stat-grid">
			<div class="stat-card">
				<span class="stat-label">Documents</span>
				<span class="stat-value">{data.rag.totalDocuments.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Ready</span>
				<span class="stat-value">{data.rag.readyCount.toLocaleString()}</span>
			</div>
			<div class="stat-card stat-card--error">
				<span class="stat-label">Errors</span>
				<Cluster gap="2" align="center">
					<span class="stat-value">{data.rag.errorCount.toLocaleString()}</span>
					{#if data.rag.errorCount > 0}
						<Badge variant="error">attention</Badge>
					{/if}
				</Cluster>
			</div>
			<div class="stat-card">
				<span class="stat-label">Total Chunks</span>
				<span class="stat-value">{data.rag.totalChunks.toLocaleString()}</span>
			</div>
		</div>
	</Card>
</Stack>

<style>
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-4);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.stat-card--error {
		border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat-value {
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-family: ui-monospace, monospace;
	}

	/* Provider list */
	.provider-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.provider-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.provider-name {
		font-weight: 600;
	}

	.provider-model {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.headroom {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-fg);
	}

	.headroom.muted {
		font-weight: 400;
		color: var(--color-muted);
	}

	.headroom .est {
		font-weight: 400;
		font-style: italic;
		color: var(--color-muted);
	}

	.health-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
	}

	.health-dot--success {
		background: var(--color-success);
	}

	.health-dot--secondary {
		background: var(--color-muted);
	}

	.tab-link {
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
		text-decoration: none;
	}

	.tab-link:hover {
		text-decoration: underline;
	}
</style>
