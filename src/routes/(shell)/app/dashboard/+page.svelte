<script lang="ts">
import { Card, DiagGrid, DiagRow } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';

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

		<DiagGrid>
			{#if data.user}
				<DiagRow label="Name">{data.user.name}</DiagRow>
				<DiagRow label="Email"><code>{data.user.email}</code></DiagRow>
				<DiagRow label="User ID"><code>{data.user.id}</code></DiagRow>
				{#if data.user.image}
					<DiagRow label="Avatar">
						<img src={data.user.image} alt="User avatar" class="avatar-img" />
					</DiagRow>
				{/if}
			{/if}
		</DiagGrid>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Linked Accounts</h2>
		{/snippet}

		{#if data.accounts.length > 0}
			<DiagGrid>
				{#each data.accounts as acc}
					<DiagRow label={acc.provider} class="capitalize">
						<Badge variant="success">Connected</Badge>
					</DiagRow>
				{/each}
			</DiagGrid>
		{:else}
			<p class="text-muted text-sm">No linked accounts.</p>
		{/if}
	</Card>
</Stack>

<style>
	.avatar-img {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-full);
	}
</style>
