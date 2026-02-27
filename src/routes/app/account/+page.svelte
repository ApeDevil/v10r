<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Alert, DiagGrid, DiagRow } from '$lib/components/composites';
	import { Badge, Button, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data, form } = $props();

	let revoking = $state<string | null>(null);
	let exporting = $state(false);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let deleteConfirmText = $state('');

	// If export action returned data, trigger download
	$effect(() => {
		if (form?.export) {
			const blob = new Blob([form.export], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `velociraptor-data-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
		}
	});
</script>

<svelte:head>
	<title>Account - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<!-- Active Sessions -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Active Sessions</h2>
		{/snippet}

		<DiagGrid>
			{#each data.sessions as sess}
				<div class="session-row">
					<div class="session-info">
						<div class="flex items-center gap-2">
							<code class="font-mono text-fluid-xs">{sess.displayId}</code>
							{#if sess.isCurrent}
								<Badge variant="success">Current</Badge>
							{/if}
						</div>
						{#if sess.ipAddress}
							<span class="text-xs text-muted">IP: {sess.ipAddress}</span>
						{/if}
						<span class="text-xs text-muted">
							Expires: {new Date(sess.expiresAt).toLocaleDateString()}
						</span>
					</div>
					{#if !sess.isCurrent}
						<form
							method="POST"
							action="?/revokeSession"
							use:enhance={() => {
								revoking = sess.id;
								return async ({ update }) => {
									await update();
									revoking = null;
								};
							}}
						>
							<input type="hidden" name="sessionId" value={sess.id} />
							<Button type="submit" variant="outline" size="sm" disabled={revoking === sess.id}>
								{#if revoking === sess.id}
									<Spinner size="xs" class="mr-1" />
								{/if}
								Revoke
							</Button>
						</form>
					{/if}
				</div>
			{/each}
		</DiagGrid>
	</Card>

	<!-- Linked Accounts -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Linked Accounts</h2>
		{/snippet}

		<DiagGrid>
			{#each data.accounts as acc}
				<DiagRow label={acc.provider} class="capitalize">
					<Badge variant="success">Connected</Badge>
				</DiagRow>
			{/each}
		</DiagGrid>
	</Card>

	<!-- Data Export -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Export Data</h2>
		{/snippet}

		<p class="text-sm text-muted mb-4">
			Download a JSON file containing all your account data including profile, linked accounts, and sessions.
		</p>

		<form
			method="POST"
			action="?/exportData"
			use:enhance={() => {
				exporting = true;
				return async ({ update }) => {
					await update();
					exporting = false;
				};
			}}
		>
			<Button type="submit" variant="outline" disabled={exporting}>
				{#if exporting}
					<Spinner size="xs" class="mr-2" />
				{/if}
				<span class="i-lucide-download h-4 w-4 mr-1" />
				Export My Data
			</Button>
		</form>
	</Card>

	<!-- Delete Account -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold text-error">Danger Zone</h2>
		{/snippet}

		<p class="text-sm text-muted mb-4">
			Permanently delete your account and all associated data. This action cannot be undone.
		</p>

		{#if !confirmDelete}
			<Button variant="destructive" onclick={() => (confirmDelete = true)}>
				<span class="i-lucide-trash-2 h-4 w-4 mr-1" />
				Delete Account
			</Button>
		{:else}
			<Alert variant="error" title="Are you sure?">
				{#snippet children()}
					<p>This will permanently delete your account, all sessions, and linked providers.</p>
					<p class="text-sm mt-2">Type <strong>DELETE</strong> to confirm:</p>
					<input
						type="text"
						bind:value={deleteConfirmText}
						placeholder="DELETE"
						class="delete-confirm-input"
						autocomplete="off"
					/>
					<div class="flex gap-3 mt-4">
						<form
							method="POST"
							action="?/deleteAccount"
							use:enhance={() => {
								deleting = true;
								return async ({ update }) => {
									await update();
									deleting = false;
								};
							}}
						>
							<input type="hidden" name="confirmation" value={deleteConfirmText} />
							<Button type="submit" variant="destructive" disabled={deleting || deleteConfirmText !== 'DELETE'}>
								{#if deleting}
									<Spinner size="xs" class="mr-2" />
								{/if}
								Yes, Delete My Account
							</Button>
						</form>
						<Button variant="outline" onclick={() => { confirmDelete = false; deleteConfirmText = ''; }}>
							Cancel
						</Button>
					</div>
				{/snippet}
			</Alert>
		{/if}
	</Card>
</Stack>

<style>
	.session-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.session-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.session-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.delete-confirm-input {
		margin-top: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-error-fg);
		border-radius: var(--radius-sm);
		background-color: var(--color-surface-1);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		width: 100%;
		max-width: 200px;
		outline: none;
	}
</style>
