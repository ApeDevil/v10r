<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Alert } from '$lib/components/composites';
	import { Badge, Button, Spinner } from '$lib/components/primitives';
	import { Stack, Cluster } from '$lib/components/layout';

	let { data } = $props();

	let testing = $state(false);
</script>

<svelte:head>
	<title>Connection - Auth - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
		<!-- Status -->
		<Card>
			{#snippet header()}
				<Cluster justify="between">
					<h2 class="text-fluid-lg font-semibold">Status</h2>
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
					<span class="diag-label">Auth System</span>
					{#if data.reachable}
						<Badge variant="success">Reachable</Badge>
					{:else}
						<Badge variant="error">Error</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Query Latency</span>
					<code class="diag-mono">{data.latencyMs}ms</code>
				</div>

				<div class="diag-row">
					<span class="diag-label">Session Status</span>
					{#if data.authenticated}
						<Badge variant="success">Authenticated</Badge>
					{:else}
						<Badge variant="default">Anonymous</Badge>
					{/if}
				</div>

				{#if data.authenticated}
					<div class="diag-row">
						<span class="diag-label">User</span>
						<span class="diag-value">{data.userName} ({data.userEmail})</span>
					</div>
				{/if}

				<div class="diag-row">
					<span class="diag-label">Measured At</span>
					<code class="diag-mono">{data.measuredAt}</code>
				</div>
			</div>
		</Card>

		<!-- Provider Config -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">OAuth Providers</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">GitHub</span>
					{#if data.providers.github}
						<Badge variant="success">Configured</Badge>
					{:else}
						<Badge variant="warning">Missing credentials</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Google</span>
					{#if data.providers.google}
						<Badge variant="success">Configured</Badge>
					{:else}
						<Badge variant="warning">Missing credentials</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Base URL</span>
					<code class="diag-mono">{data.baseURL}</code>
				</div>
			</div>
		</Card>

		{#if !data.reachable}
			<Alert variant="error" title="Auth System Error">
				{#snippet children()}
					<code class="diag-mono">{data.error}</code>
					<p>Check that <code>BETTER_AUTH_SECRET</code> and <code>BETTER_AUTH_URL</code> are set in <code>.env</code>.</p>
				{/snippet}
			</Alert>
		{/if}
	</Stack>

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
		font-size: var(--text-fluid-sm);
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}
</style>
