<script lang="ts">
	import { Card } from '$lib/components/composites';
	import { Badge } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Profile</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Name</span>
				<span class="diag-value">{data.user.name}</span>
			</div>
			<div class="diag-row">
				<span class="diag-label">Email</span>
				<code class="diag-mono">{data.user.email}</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">User ID</span>
				<code class="diag-mono">{data.user.id}</code>
			</div>
			{#if data.user.image}
				<div class="diag-row">
					<span class="diag-label">Avatar</span>
					<img src={data.user.image} alt="User avatar" class="avatar-img" />
				</div>
			{/if}
		</div>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Linked Accounts</h2>
		{/snippet}

		{#if data.accounts.length > 0}
			<div class="diag-grid">
				{#each data.accounts as acc}
					<div class="diag-row">
						<span class="diag-label capitalize">{acc.provider}</span>
						<Badge variant="success">Connected</Badge>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-muted text-sm">No linked accounts.</p>
		{/if}
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

	.avatar-img {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-full);
	}
</style>
