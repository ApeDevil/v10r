<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card } from '$lib/components/composites';
	import { Badge, Button, Spinner } from '$lib/components/primitives';

	let { data } = $props();

	let testing = $state(false);

	const latencyTier = $derived(
		data.latencyMs < 200 ? 'warm' :
		data.latencyMs < 2000 ? 'waking' : 'cold'
	);

	const tierVariant = $derived(
		latencyTier === 'warm' ? 'success' as const :
		latencyTier === 'waking' ? 'warning' as const : 'error' as const
	);

	const tierLabel = $derived(
		latencyTier === 'warm' ? 'Warm' :
		latencyTier === 'waking' ? 'Waking' : 'Cold Start'
	);

	let history = $state<{ ms: number; tier: string; variant: 'success' | 'warning' | 'error' }[]>([]);

	function recordHistory(ms: number) {
		const tier = ms < 200 ? 'Warm' : ms < 2000 ? 'Wake' : 'Cold';
		const variant = ms < 200 ? 'success' as const : ms < 2000 ? 'warning' as const : 'error' as const;
		history = [...history.slice(-4), { ms, tier, variant }];
	}
</script>

<svelte:head>
	<title>Connection - Graph - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Connection"
		description="Live Neo4j Aura health check via HTTP Query API. The latency below was measured during your page load."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Graph', href: '/showcases/db/neo4j' },
			{ label: 'Connection' }
		]}
	/>

	<div class="cards">
		<!-- Status -->
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<h2 class="text-fluid-lg font-semibold">Status</h2>
					<form
						method="POST"
						action="?/retest"
						use:enhance={() => {
							testing = true;
							return async ({ update }) => {
								await update();
								recordHistory(data.latencyMs);
								testing = false;
							};
						}}
					>
						<Button type="submit" variant="outline" size="sm" disabled={testing}>
							{#if testing}
								<Spinner size="xs" class="mr-2" />
							{/if}
							<span class="i-lucide-activity h-4 w-4 mr-1" />
							Re-test
						</Button>
					</form>
				</div>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Connection</span>
					{#if data.connected}
						<Badge variant="success">Connected</Badge>
					{:else}
						<Badge variant="error">Error</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Query Latency</span>
					<span class="diag-value">
						<code>{data.latencyMs}ms</code>
						<Badge variant={tierVariant}>{tierLabel}</Badge>
					</span>
				</div>

				<div class="diag-row">
					<span class="diag-label">Measured At</span>
					<code class="diag-mono">{data.measuredAt}</code>
				</div>
			</div>

			{#if history.length > 0}
				<div class="latency-history">
					<span class="diag-label">History</span>
					<div class="history-badges">
						{#each history as h}
							<Badge variant={h.variant}>{h.tier} {h.ms}ms</Badge>
						{/each}
					</div>
				</div>
			{/if}
		</Card>

		{#if data.connected}
			<!-- Instance Info -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Instance Info</h2>
				{/snippet}

				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Neo4j Version</span>
						<code class="diag-mono">{data.neo4jVersion}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Edition</span>
						<code class="diag-mono">{data.edition}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Node Count</span>
						<code class="diag-mono">{data.nodeCount}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Relationship Count</span>
						<code class="diag-mono">{data.relCount}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Labels</span>
						<code class="diag-mono">{data.labelCount}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Relationship Types</span>
						<code class="diag-mono">{data.relTypeCount}</code>
					</div>
				</div>
			</Card>

			<!-- Latency Explanation -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">About Aura Latency</h2>
				{/snippet}

				<div class="explanation">
					<p>Neo4j Aura free instances auto-pause after inactivity. The first query after pause includes instance resume time (10-30 seconds).</p>

					<div class="tier-legend">
						<div class="tier-item">
							<Badge variant="success">Warm</Badge>
							<span>&lt; 200ms — Instance was already running</span>
						</div>
						<div class="tier-item">
							<Badge variant="warning">Waking</Badge>
							<span>200–2000ms — Instance was resuming from pause</span>
						</div>
						<div class="tier-item">
							<Badge variant="error">Cold Start</Badge>
							<span>&gt; 2s — Instance was fully paused, long resume required</span>
						</div>
					</div>

					<p class="hint">Click Re-test to measure latency without a full page reload. Consecutive tests should show warm latency.</p>
				</div>
			</Card>
		{:else}
			<!-- Error State -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Connection Error</h2>
				{/snippet}

				<div class="error-info">
					<code class="error-msg">{data.error}</code>
					<p>Check that <code>NEO4J_URI</code>, <code>NEO4J_USERNAME</code>, and <code>NEO4J_PASSWORD</code> are set in <code>.env</code> and point to a valid Neo4j Aura instance.</p>
				</div>
			</Card>
		{/if}
	</div>

	<BackLink href="/showcases/db/neo4j" label="Graph" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.card-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.latency-history {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	.history-badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.explanation {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.explanation p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.tier-legend {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.tier-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
	}

	.hint {
		font-style: italic;
	}

	.error-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.error-msg {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		color: var(--color-error);
		word-break: break-all;
	}

	.error-info p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
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
