<script lang="ts">
	import { Card } from '$lib/components/composites';
	import { Badge } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data } = $props();
</script>

<svelte:head>
	<title>Channels - Notifications - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<!-- Provider Config -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Provider Configuration</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Email ({data.providers.email.name})</span>
				{#if data.providers.email.configured}
					<Badge variant="success">Configured</Badge>
				{:else}
					<Badge variant="warning">Missing</Badge>
				{/if}
			</div>

			<div class="diag-row">
				<span class="diag-label">Telegram ({data.providers.telegram.name})</span>
				{#if data.providers.telegram.configured}
					<Badge variant="success">Configured</Badge>
				{:else}
					<Badge variant="warning">Missing</Badge>
				{/if}
			</div>

			<div class="diag-row">
				<span class="diag-label">Discord ({data.providers.discord.name})</span>
				{#if data.providers.discord.configured}
					<Badge variant="success">Configured</Badge>
				{:else}
					<Badge variant="warning">Missing</Badge>
				{/if}
			</div>
		</div>
	</Card>

	<!-- User Channels -->
	{#if data.userChannels}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Your Channels</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">In-App (SSE)</span>
					<Badge variant="success">Active</Badge>
				</div>

				<div class="diag-row">
					<span class="diag-label">Email</span>
					<code class="diag-mono">{data.userChannels.email}</code>
				</div>

				<div class="diag-row">
					<span class="diag-label">Telegram</span>
					{#if data.userChannels.telegram?.active}
						<span class="diag-value">
							<Badge variant="success">Connected</Badge>
							<code class="diag-mono">@{data.userChannels.telegram.username}</code>
						</span>
					{:else}
						<span class="diag-value">
							<Badge variant="secondary">Not connected</Badge>
							<a href="/app/notifications/settings" class="diag-link">Settings</a>
						</span>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Discord</span>
					{#if data.userChannels.discord?.active}
						<span class="diag-value">
							<Badge variant="success">Connected</Badge>
							<code class="diag-mono">{data.userChannels.discord.username}</code>
						</span>
					{:else}
						<span class="diag-value">
							<Badge variant="secondary">Not connected</Badge>
							<a href="/app/notifications/settings" class="diag-link">Settings</a>
						</span>
					{/if}
				</div>
			</div>
		</Card>
	{/if}

	<!-- System Config -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">System Configuration</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Delivery Interval</span>
				<code class="diag-mono">{data.config.deliveryIntervalMs}ms</code>
			</div>

			<div class="diag-row">
				<span class="diag-label">Max Delivery Attempts</span>
				<code class="diag-mono">{data.config.deliveryMaxAttempts}</code>
			</div>

			<div class="diag-row">
				<span class="diag-label">SSE Heartbeat</span>
				<code class="diag-mono">{data.config.sseHeartbeatMs}ms</code>
			</div>

			<div class="diag-row">
				<span class="diag-label">Max SSE per User</span>
				<code class="diag-mono">{data.config.sseMaxPerUser}</code>
			</div>
		</div>
	</Card>

	<!-- Key Files -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Key Files</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Service</span>
				<code class="diag-mono">src/lib/server/notifications/service.ts</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Router</span>
				<code class="diag-mono">src/lib/server/notifications/router.ts</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Outbox</span>
				<code class="diag-mono">src/lib/server/notifications/outbox.ts</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">SSE Stream</span>
				<code class="diag-mono">src/lib/server/notifications/stream.ts</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Providers</span>
				<code class="diag-mono">src/lib/server/notifications/providers/</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Schema</span>
				<code class="diag-mono">src/lib/server/db/schema/notifications/</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Settings UI</span>
				<code class="diag-mono">src/routes/app/notifications/settings/</code>
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
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.diag-link {
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		text-decoration: none;
	}

	.diag-link:hover {
		text-decoration: underline;
	}
</style>
