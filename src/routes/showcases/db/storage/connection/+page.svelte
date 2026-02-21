<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card, ConfirmDialog, Alert } from '$lib/components/composites';
	import { Badge, Button, Spinner, Typography } from '$lib/components/primitives';
	import { PageContainer, Stack, Cluster } from '$lib/components/layout';
	import { getToast } from '$lib/stores/toast.svelte';

	let { data } = $props();
	const toast = getToast();

	let testing = $state(false);
	let reseedDialogOpen = $state(false);
	let reseeding = $state(false);

	const latencyTier = $derived(
		data.latencyMs < 150 ? 'fast' :
		data.latencyMs < 500 ? 'slow' : 'degraded'
	);

	const tierVariant = $derived(
		latencyTier === 'fast' ? 'success' as const :
		latencyTier === 'slow' ? 'warning' as const : 'error' as const
	);

	const tierLabel = $derived(
		latencyTier === 'fast' ? 'Fast' :
		latencyTier === 'slow' ? 'Slow' : 'Degraded'
	);

	let history = $state<{ ms: number; tier: string; variant: 'success' | 'warning' | 'error' }[]>([]);

	function recordHistory(ms: number) {
		const tier = ms < 150 ? 'Fast' : ms < 500 ? 'Slow' : 'Degraded';
		const variant = ms < 150 ? 'success' as const : ms < 500 ? 'warning' as const : 'error' as const;
		history = [...history.slice(-4), { ms, tier, variant }];
	}
</script>

<svelte:head>
	<title>Connection - Storage - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Connection"
		description="Live R2 bucket health check via S3-compatible API. The latency below was measured during your page load."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Storage', href: '/showcases/db/storage' },
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
				</Cluster>
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
					<span class="diag-label">List Latency</span>
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
			<!-- Bucket Info -->
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Bucket Info</Typography>
				{/snippet}

				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Bucket Name</span>
						<code class="diag-mono">{data.bucketName}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Region</span>
						<code class="diag-mono">{data.region}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Showcase Objects</span>
						<code class="diag-mono">{data.objectCount}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Total Size</span>
						<code class="diag-mono">{data.totalSizeFormatted}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Account ID</span>
						<code class="diag-mono">{data.accountId}</code>
					</div>
				</div>
			</Card>

			<!-- About R2 Latency -->
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">About R2 Latency</Typography>
				{/snippet}

				<div class="explanation">
					<p>R2 is always-on — there are no cold starts like Neon (PostgreSQL) or Aura (Neo4j). Buckets are instantly available 24/7.</p>

					<div class="tier-legend">
						<Cluster gap="3">
							<Badge variant="success">Fast</Badge>
							<span>&lt; 150ms — Low network distance to R2 edge</span>
						</Cluster>
						<Cluster gap="3">
							<Badge variant="warning">Slow</Badge>
							<span>150–500ms — Higher network distance or listing many objects</span>
						</Cluster>
						<Cluster gap="3">
							<Badge variant="error">Degraded</Badge>
							<span>&gt; 500ms — Network issues or R2 service degradation</span>
						</Cluster>
					</div>

					<p class="hint">Latency tiers reflect network distance, not wake-up time. Click Re-test to measure again.</p>
				</div>
			</Card>
		{:else}
			<!-- Error State -->
			<Alert variant="error" title="Connection Error">
				{#snippet children()}
					<code class="alert-code">{data.error}</code>
					<p class="alert-text">Check that the following environment variables are set in <code>.env</code>:</p>
					<ul class="env-checklist">
						<li><code>R2_ACCOUNT_ID</code></li>
						<li><code>R2_ACCESS_KEY_ID</code></li>
						<li><code>R2_SECRET_ACCESS_KEY</code></li>
						<li><code>R2_BUCKET_NAME</code></li>
					</ul>
				{/snippet}
			</Alert>
		{/if}
	</Stack>

	{#if data.connected}
		<Cluster justify="center" class="mt-6 mb-4">
			<Button variant="outline" size="sm" onclick={() => reseedDialogOpen = true} disabled={reseeding}>
				{#if reseeding}
					<Spinner size="xs" class="mr-2" />
				{/if}
				<span class="i-lucide-rotate-ccw h-4 w-4 mr-1" />
				Reseed Showcase Data
			</Button>
		</Cluster>
	{/if}

	<BackLink href="/showcases/db/storage" label="Storage" />
</PageContainer>

<ConfirmDialog
	bind:open={reseedDialogOpen}
	title="Reseed Showcase Data"
	description="This will delete all objects under showcase/ and re-upload the 11 seed objects. This cannot be undone."
	confirmLabel="Reseed"
	destructive
	onconfirm={() => {
		reseedDialogOpen = false;
		const form = document.getElementById('reseed-form') as HTMLFormElement;
		form?.requestSubmit();
	}}
	oncancel={() => reseedDialogOpen = false}
/>

<form
	id="reseed-form"
	method="POST"
	action="?/reseed"
	class="hidden"
	use:enhance={() => {
		reseeding = true;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success(result.data?.message || 'Showcase data reseeded.');
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Reseed failed.');
			}
			reseeding = false;
			return update();
		};
	}}
>
</form>

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
		font-size: var(--text-fluid-sm);
	}

	.hint {
		font-style: italic;
	}

	.alert-code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		word-break: break-all;
	}

	.alert-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
	}

	.env-checklist {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.env-checklist li {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.env-checklist li::before {
		content: '•';
		color: var(--color-muted);
	}

	.env-checklist code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.hidden {
		display: none;
	}
</style>
