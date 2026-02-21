<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card } from '$lib/components/composites';
	import { Badge, Button, Spinner } from '$lib/components/primitives';

	let { data } = $props();

	let testing = $state(false);

	const latencyTier = $derived(
		data.latencyMs < 100 ? 'warm' :
		data.latencyMs < 1000 ? 'waking' : 'cold'
	);

	const tierVariant = $derived(
		latencyTier === 'warm' ? 'success' as const :
		latencyTier === 'waking' ? 'warning' as const : 'error' as const
	);

	const tierLabel = $derived(
		latencyTier === 'warm' ? 'Warm' :
		latencyTier === 'waking' ? 'Pool Wake' : 'Cold Start'
	);

	// Client-side latency history (last 5 results)
	let history = $state<{ ms: number; tier: string; variant: 'success' | 'warning' | 'error' }[]>([]);

	function recordHistory(ms: number) {
		const tier = ms < 100 ? 'Warm' : ms < 1000 ? 'Wake' : 'Cold';
		const variant = ms < 100 ? 'success' as const : ms < 1000 ? 'warning' as const : 'error' as const;
		history = [...history.slice(-4), { ms, tier, variant }];
	}
</script>

<svelte:head>
	<title>Connection - PostgreSQL - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Connection"
		description="Live Neon PostgreSQL health check. The latency below was measured during your page load."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'PostgreSQL', href: '/showcases/db/postgres' },
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
			<!-- Database Info -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Database Info</h2>
				{/snippet}

				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">PostgreSQL Version</span>
						<code class="diag-mono">{data.pgVersion}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Database Name</span>
						<code class="diag-mono">{data.dbName}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Current Schema</span>
						<code class="diag-mono">{data.currentSchema}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Database Size</span>
						<code class="diag-mono">{data.dbSize}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Active Connections</span>
						<code class="diag-mono">{data.activeConnections}</code>
					</div>
				</div>
			</Card>

			<!-- Latency Explanation -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">About Neon Latency</h2>
				{/snippet}

				<div class="explanation">
					<p>Neon PostgreSQL scales to zero after 5 minutes of inactivity. The first query after idle includes compute wake-up time.</p>

					<div class="tier-legend">
						<div class="tier-item">
							<Badge variant="success">Warm</Badge>
							<span>&lt; 100ms — Compute was already running</span>
						</div>
						<div class="tier-item">
							<Badge variant="warning">Pool Wake</Badge>
							<span>100–999ms — Connection pool was warming up</span>
						</div>
						<div class="tier-item">
							<Badge variant="error">Cold Start</Badge>
							<span>&gt; 1s — Compute was suspended, full wake-up required</span>
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
					<p>Check that <code>DATABASE_URL</code> is set in <code>.env</code> and points to a valid Neon database with <code>?sslmode=require</code>.</p>
				</div>
			</Card>
		{/if}
	</div>

	<BackLink href="/showcases/db/postgres" label="PostgreSQL" />
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
