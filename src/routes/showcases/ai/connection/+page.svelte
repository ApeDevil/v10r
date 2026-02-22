<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card, Alert } from '$lib/components/composites';
	import { Badge, Button, Spinner, Typography } from '$lib/components/primitives';
	import { PageContainer, Stack, Cluster } from '$lib/components/layout';

	let { data } = $props();

	let testing = $state(false);

	const latencyTier = $derived(
		!data.connection.latencyMs ? 'unknown' :
		data.connection.latencyMs < 500 ? 'fast' :
		data.connection.latencyMs < 2000 ? 'normal' : 'slow'
	);

	const tierVariant = $derived(
		latencyTier === 'fast' ? 'success' as const :
		latencyTier === 'normal' ? 'warning' as const :
		latencyTier === 'unknown' ? 'secondary' as const : 'error' as const
	);

	const tierLabel = $derived(
		latencyTier === 'fast' ? 'Fast' :
		latencyTier === 'normal' ? 'Normal' :
		latencyTier === 'unknown' ? '—' : 'Slow'
	);
</script>

<svelte:head>
	<title>Connection - AI - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Connection"
		description="AI provider health check. Verifies the Groq API key is valid and measures response latency."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI', href: '/showcases/ai' },
			{ label: 'Connection' }
		]}
	/>

	<Stack gap="6">
		<!-- Status -->
		<Card>
			{#snippet header()}
				<Cluster justify="between">
					<Typography variant="h5" as="h2">Status</Typography>
					<form
						method="POST"
						action="?/retest"
						use:enhance={() => {
							testing = true;
							return async ({ update }) => {
								await update();
								testing = false;
							};
						}}
					>
						<Button type="submit" variant="outline" size="sm" disabled={testing}>
							{#if testing}
								<Spinner size="sm" class="mr-2" />
							{/if}
							<span class="i-lucide-activity h-4 w-4 mr-1"></span>
							Re-test
						</Button>
					</form>
				</Cluster>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Connection</span>
					{#if data.connection.connected}
						<Badge variant="success">Connected</Badge>
					{:else if data.connection.error?.includes('not configured')}
						<Badge variant="secondary">Not Configured</Badge>
					{:else}
						<Badge variant="error">Error</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Provider</span>
					<code class="diag-mono">{data.connection.provider}</code>
				</div>

				<div class="diag-row">
					<span class="diag-label">Model</span>
					<code class="diag-mono">{data.connection.model}</code>
				</div>

				<div class="diag-row">
					<span class="diag-label">Latency</span>
					<span class="diag-value">
						{#if data.connection.latencyMs !== null}
							<code>{data.connection.latencyMs}ms</code>
							<Badge variant={tierVariant}>{tierLabel}</Badge>
						{:else}
							<span class="text-muted">—</span>
						{/if}
					</span>
				</div>

				<div class="diag-row">
					<span class="diag-label">Measured At</span>
					<code class="diag-mono">{data.measuredAt}</code>
				</div>
			</div>
		</Card>

		<!-- Providers -->
		<Card>
			{#snippet header()}
				<Typography variant="h5" as="h2">Providers</Typography>
			{/snippet}

			<div class="diag-grid">
				{#each data.providers as provider}
					<div class="diag-row">
						<span class="diag-label">{provider.name}</span>
						<span class="diag-value">
							<code class="diag-mono">{provider.model}</code>
							{#if provider.configured}
								<Badge variant="success">Configured</Badge>
							{:else}
								<Badge variant="secondary">Not Set</Badge>
							{/if}
						</span>
					</div>
				{/each}
			</div>
		</Card>

		{#if !data.connection.connected}
			{#if data.connection.error?.includes('not configured')}
				<Alert variant="info" title="Setup Required">
					<p>Add <code>GROQ_API_KEY</code> to your <code>.env</code> file to enable AI features.</p>
					<ol class="setup-steps">
						<li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a></li>
						<li>Create a new API key</li>
						<li>Add <code>GROQ_API_KEY="gsk_..."</code> to your <code>.env</code> file</li>
						<li>Restart the dev server</li>
					</ol>
				</Alert>
			{:else}
				<Alert variant="error" title="Connection Error">
					<code>{data.connection.error}</code>
					<p>Check that <code>GROQ_API_KEY</code> is set correctly in <code>.env</code>.</p>
				</Alert>
			{/if}
		{/if}
	</Stack>

	<BackLink href="/showcases/ai" label="AI" />
</PageContainer>

<style>
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

	.setup-steps {
		margin-top: var(--spacing-3);
		padding-left: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}
</style>
