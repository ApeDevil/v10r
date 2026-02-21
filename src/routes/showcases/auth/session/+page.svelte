<script lang="ts">
	import { PageHeader, BackLink, Card } from '$lib/components/composites';
	import { Badge } from '$lib/components/primitives';
	import { PageContainer, Stack } from '$lib/components/layout';

	let { data } = $props();
</script>

<svelte:head>
	<title>Session - Auth - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Session"
		description="Session lifecycle diagnostics — current session details, cookie cache status, and auto-renewal configuration."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Auth', href: '/showcases/auth' },
			{ label: 'Session' }
		]}
	/>

	<Stack gap="6">
		<!-- Current Session -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Current Session</h2>
			{/snippet}

			{#if data.authenticated && data.session}
				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Status</span>
						<Badge variant="success">Active</Badge>
					</div>
					<div class="diag-row">
						<span class="diag-label">Session ID</span>
						<code class="diag-mono">{data.session.id}</code>
					</div>
					<div class="diag-row">
						<span class="diag-label">User</span>
						<span class="diag-value">{data.user?.name} ({data.user?.email})</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Created</span>
						<code class="diag-mono">{data.session.createdAt}</code>
					</div>
					<div class="diag-row">
						<span class="diag-label">Expires</span>
						<code class="diag-mono">{data.session.expiresAt}</code>
					</div>
					<div class="diag-row">
						<span class="diag-label">Last Updated</span>
						<code class="diag-mono">{data.session.updatedAt}</code>
					</div>
					{#if data.session.ipAddress}
						<div class="diag-row">
							<span class="diag-label">IP Address</span>
							<code class="diag-mono">{data.session.ipAddress}</code>
						</div>
					{/if}
				</div>
			{:else}
				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Status</span>
						<Badge variant="default">Anonymous</Badge>
					</div>
				</div>
				<p class="text-sm text-muted mt-3">
					Sign in to see session details. Visit <a href="/auth/login" class="text-primary">/auth/login</a>.
				</p>
			{/if}
		</Card>

		<!-- Cookie Cache -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Cookie Cache</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Enabled</span>
					<Badge variant={data.cookieCache.enabled ? 'success' : 'warning'}>
						{data.cookieCache.enabled ? 'Yes' : 'No'}
					</Badge>
				</div>
				<div class="diag-row">
					<span class="diag-label">Max Age</span>
					<code class="diag-mono">{data.cookieCache.maxAge}s</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Behavior</span>
					<span class="diag-value">{data.cookieCache.description}</span>
				</div>
			</div>
		</Card>

		<!-- Lifecycle -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Session Lifecycle</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Expires In</span>
					<code class="diag-mono">{data.lifecycle.expiresIn}</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Update Age</span>
					<code class="diag-mono">{data.lifecycle.updateAge}</code>
				</div>
			</div>

			<div class="explanation">
				<p>{data.lifecycle.description}</p>

				<div class="lifecycle-flow">
					<div class="flow-step">
						<Badge variant="success">Login</Badge>
						<span>Session created, 7-day expiry set</span>
					</div>
					<div class="flow-step">
						<Badge variant="success">Activity (within 24h)</Badge>
						<span>Expiry auto-refreshed to 7 days from now</span>
					</div>
					<div class="flow-step">
						<Badge variant="warning">Idle (24h–7d)</Badge>
						<span>Session valid but not refreshing</span>
					</div>
					<div class="flow-step">
						<Badge variant="error">Expired (7d idle)</Badge>
						<span>Must sign in again</span>
					</div>
				</div>
			</div>
		</Card>
	</Stack>

	<BackLink href="/showcases/auth" label="Auth" />
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
		font-size: var(--text-fluid-sm);
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.explanation {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	.explanation p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.lifecycle-flow {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.flow-step {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
	}
</style>
