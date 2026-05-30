<script lang="ts">
import { enhance } from '$app/forms';
import { Button, Typography } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

let { data, form } = $props();

const toast = getToast();

$effect(() => {
	if (!form) return;
	if ((form as { approved?: boolean }).approved) toast?.success('Request approved');
	if ((form as { denied?: boolean }).denied) toast?.success('Request denied');
	if ((form as { error?: string }).error) toast?.error((form as { error: string }).error);
});
</script>

<Typography variant="h2">Pending requests ({data.items.length})</Typography>

{#if data.items.length === 0}
	<p class="muted">No pending requests.</p>
{:else}
	<ul class="queue">
		{#each data.items as r (r.id)}
			<li>
				<div class="meta">
					<strong>{r.userName}</strong>
					<small>{r.userEmail}</small>
					<span class="kind">{r.kind}</span>
					<time>{new Date(r.requestedAt).toLocaleString()}</time>
				</div>
				{#if r.message}<p class="msg">{r.message}</p>{/if}
				<div class="actions">
					<form method="POST" action="?/approve" use:enhance>
						<input type="hidden" name="id" value={r.id} />
						<Button type="submit">Approve</Button>
					</form>
					<form method="POST" action="?/deny" use:enhance>
						<input type="hidden" name="id" value={r.id} />
						<Button type="submit" variant="ghost">Deny</Button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.queue {
		list-style: none;
		padding: 0;
		margin-top: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.queue li {
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.meta {
		display: flex;
		gap: var(--spacing-3);
		align-items: baseline;
		flex-wrap: wrap;
	}
	small {
		color: var(--color-muted);
	}
	.kind {
		font-size: 0.75rem;
		padding: 2px 6px;
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		border-radius: var(--radius-sm);
	}
	time {
		color: var(--color-muted);
		font-size: 0.85rem;
	}
	.msg {
		color: var(--color-muted);
		font-style: italic;
		margin: 0;
	}
	.actions {
		display: flex;
		gap: var(--spacing-2);
	}
	.muted {
		color: var(--color-muted);
		margin-top: var(--spacing-4);
	}
</style>
