<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';

let { data } = $props();
</script>

<svelte:head>
	<title>Security - Auth - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
		<!-- Security Headers -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Security Headers</h2>
			{/snippet}

			<div class="diag-grid">
				{#each Object.entries(data.headers) as [header, value]}
					<div class="diag-row">
						<span class="diag-label">{header}</span>
						<code class="diag-mono">{value}</code>
					</div>
				{/each}
			</div>
		</Card>

		<!-- CSRF -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">CSRF Protection</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Status</span>
					<Badge variant={data.csrf.enabled ? 'success' : 'error'}>
						{data.csrf.enabled ? 'Enabled' : 'Disabled'}
					</Badge>
				</div>
				<div class="diag-row">
					<span class="diag-label">Mechanism</span>
					<span class="diag-value">{data.csrf.description}</span>
				</div>
			</div>
		</Card>

		<!-- Trusted Origins -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Trusted Origins</h2>
			{/snippet}

			<div class="diag-grid">
				{#each data.trustedOrigins as origin}
					<div class="diag-row">
						<span class="diag-label">Origin</span>
						<code class="diag-mono">{origin}</code>
					</div>
				{/each}
			</div>

			<p class="text-sm text-muted mt-3">
				Only requests from these origins are accepted. No wildcards — explicit origins only (past CVE CVSS 9.3).
			</p>
		</Card>

		<!-- Rate Limiting -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Rate Limiting</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Built-in</span>
					<span class="diag-value">{data.rateLimiting.builtin}</span>
				</div>
				<div class="diag-row">
					<span class="diag-label">External</span>
					<span class="diag-value">{data.rateLimiting.external}</span>
				</div>
			</div>
		</Card>

		<!-- Version -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">System Info</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Better Auth Version</span>
					<code class="diag-mono">{data.betterAuthVersion}</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Measured At</span>
					<code class="diag-mono">{data.measuredAt}</code>
				</div>
			</div>
		</Card>
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
