<script lang="ts">
import { enhance } from '$app/forms';
import { Alert, Card, ConfirmDialog } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Spinner, Typography } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();
const toast = getToast();

let testing = $state(false);
let reseedDialogOpen = $state(false);
let reseeding = $state(false);

const latencyTier = $derived(data.latencyMs < 50 ? 'fast' : data.latencyMs < 200 ? 'normal' : 'degraded');

const tierVariant = $derived(
	latencyTier === 'fast' ? ('success' as const) : latencyTier === 'normal' ? ('warning' as const) : ('error' as const),
);

const tierLabel = $derived(latencyTier === 'fast' ? 'Fast' : latencyTier === 'normal' ? 'Normal' : 'Degraded');

let history = $state<{ ms: number; tier: string; variant: 'success' | 'warning' | 'error' }[]>([]);

function recordHistory(ms: number) {
	const tier = ms < 50 ? 'Fast' : ms < 200 ? 'Normal' : 'Degraded';
	const variant = ms < 50 ? ('success' as const) : ms < 200 ? ('warning' as const) : ('error' as const);
	history = [...history.slice(-4), { ms, tier, variant }];
}
</script>
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
							<span class="i-lucide-activity h-4 w-4 mr-1" ></span>
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
					<span class="diag-label">PING Latency</span>
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
					<Typography variant="h5" as="h2">Instance Info</Typography>
				{/snippet}

				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Showcase Keys</span>
						<code class="diag-mono">{data.keyCount}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Endpoint</span>
						<code class="diag-mono">{data.endpoint}</code>
					</div>

					<div class="diag-row">
						<span class="diag-label">Protocol</span>
						<code class="diag-mono">HTTP/REST</code>
					</div>
				</div>
			</Card>

			<!-- About Redis Latency -->
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">About Redis Latency</Typography>
				{/snippet}

				<div class="explanation">
					<p>Upstash Redis is always-on via HTTP — no cold starts, no TCP connection overhead. Latency reflects network round-trip to the Upstash region.</p>

					<div class="tier-legend">
						<Cluster gap="3">
							<Badge variant="success">Fast</Badge>
							<span>&lt; 50ms — Upstash region matches deployment region</span>
						</Cluster>
						<Cluster gap="3">
							<Badge variant="warning">Normal</Badge>
							<span>50–200ms — Cross-region or moderate network distance</span>
						</Cluster>
						<Cluster gap="3">
							<Badge variant="error">Degraded</Badge>
							<span>&gt; 200ms — Region mismatch or network issues</span>
						</Cluster>
					</div>

					<p class="hint">For best latency, create the Upstash database in the same region as your Vercel functions (default: us-east-1).</p>
				</div>
			</Card>
		{:else}
			<!-- Error State -->
			<Alert variant="error" title="Connection Error" description={data.error}>
				{#snippet children()}
					<p class="alert-text">Check that the following environment variables are set in <code>.env</code>:</p>
					<ul class="env-checklist">
						<li><code>UPSTASH_REDIS_REST_URL</code></li>
						<li><code>UPSTASH_REDIS_REST_TOKEN</code></li>
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
				<span class="i-lucide-rotate-ccw h-4 w-4 mr-1" ></span>
				Reseed Showcase Data
			</Button>
		</Cluster>
	{/if}

<ConfirmDialog
	bind:open={reseedDialogOpen}
	title="Reseed Showcase Data"
	description="This will delete all keys under showcase:* and re-create the seed entries. This cannot be undone."
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
				toast.success((result.data?.message as string) || 'Showcase data reseeded.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.message as string) || 'Reseed failed.');
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
