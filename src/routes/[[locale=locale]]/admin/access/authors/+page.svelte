<script lang="ts">
import { enhance } from '$app/forms';
import { Stack } from '$lib/components/layout';
import { Button, Dialog, Input, Typography } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

let { data, form } = $props();

const toast = getToast();
let q = $state(data.query);
let confirmDialog = $state<{ userId: string; draftCount: number } | null>(null);
let dialogOpen = $state(false);

$effect(() => {
	if (!form) return;
	if ((form as { requiresConfirm?: boolean }).requiresConfirm) {
		confirmDialog = {
			userId: (form as { userId: string }).userId,
			draftCount: (form as { draftCount: number }).draftCount,
		};
		dialogOpen = true;
	} else if ((form as { granted?: boolean }).granted) {
		toast?.success('Blog-author granted');
		confirmDialog = null;
	} else if ((form as { revoked?: boolean }).revoked) {
		toast?.success('Blog-author revoked');
		confirmDialog = null;
	}
});
</script>

<Stack class="gap-7">
	<section>
		<Typography variant="h2">Grant blog-author</Typography>
		<form method="GET" class="search">
			<Input bind:value={q} name="q" placeholder="Search by email or name" />
			<Button type="submit">Search</Button>
		</form>
		{#if data.searchResults.length > 0}
			<ul class="results">
				{#each data.searchResults as u (u.id)}
					<li>
						<span>{u.name} <small>({u.email})</small></span>
						<form method="POST" action="?/grant" use:enhance>
							<input type="hidden" name="userId" value={u.id} />
							<Button type="submit" variant="ghost">Grant</Button>
						</form>
					</li>
				{/each}
			</ul>
		{:else if data.query}
			<p class="muted">No matches.</p>
		{/if}
	</section>

	<section>
		<Typography variant="h2">Current authors ({data.authors.length})</Typography>
		{#if data.authors.length === 0}
			<p class="muted">No active blog-author grants yet.</p>
		{:else}
			<ul class="authors">
				{#each data.authors as a (a.id)}
					<li>
						<div>
							<strong>{a.name}</strong>
							<small>{a.email}</small>
							<time datetime={a.grantedAt.toISOString()}>granted {new Date(a.grantedAt).toLocaleDateString()}</time>
						</div>
						<form method="POST" action="?/revoke" use:enhance>
							<input type="hidden" name="userId" value={a.userId} />
							<Button type="submit" variant="ghost">Revoke</Button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</Stack>

{#if confirmDialog}
	{@const dlg = confirmDialog}
	<Dialog bind:open={dialogOpen} title="Revoke with drafts?">
		{#snippet children()}
			<p>This user has {dlg.draftCount} unpublished draft{dlg.draftCount === 1 ? '' : 's'}. Drafts will become read-only and require admin reassignment to publish.</p>
			<div class="dialog-actions">
				<Button variant="ghost" onclick={() => { confirmDialog = null; dialogOpen = false; }}>Cancel</Button>
				<form method="POST" action="?/revoke" use:enhance>
					<input type="hidden" name="userId" value={dlg.userId} />
					<input type="hidden" name="confirmed" value="true" />
					<Button type="submit" variant="destructive">Revoke access</Button>
				</form>
			</div>
		{/snippet}
	</Dialog>
{/if}

<style>
	.search {
		display: flex;
		gap: var(--spacing-2);
		margin: var(--spacing-3) 0;
	}
	.results,
	.authors {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.results li,
	.authors li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.authors li div {
		display: flex;
		gap: var(--spacing-3);
		align-items: baseline;
	}
	small {
		color: var(--color-muted);
	}
	time {
		color: var(--color-muted);
		font-size: 0.85rem;
	}
	.muted {
		color: var(--color-muted);
	}
	.dialog-body {
		padding: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-2);
	}
</style>
