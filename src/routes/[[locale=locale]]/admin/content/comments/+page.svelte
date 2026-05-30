<script lang="ts">
import { enhance } from '$app/forms';
import { Stack } from '$lib/components/layout';
import { Button, Input, Typography } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

let { data, form } = $props();

const toast = getToast();
const statusOptions = [
	{ value: 'all', label: 'All' },
	{ value: 'visible', label: 'Visible' },
	{ value: 'hidden', label: 'Hidden' },
	{ value: 'removed', label: 'Removed' },
];

$effect(() => {
	if (!form) return;
	if ((form as { hidden?: boolean }).hidden) toast?.success('Comment hidden');
	if ((form as { restored?: boolean }).restored) toast?.success('Comment restored');
	if ((form as { removed?: boolean }).removed) toast?.success('Comment removed');
});
</script>

<Stack class="gap-5 p-7">
	<Typography variant="h1">Comment moderation</Typography>

	<form method="GET" class="filters">
		<label>
			Status
			<select name="status" value={data.filters.status}>
				{#each statusOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
		<Input name="postId" value={data.filters.postId} placeholder="Post ID" />
		<Input name="q" value={data.filters.q} placeholder="Search body" />
		<Button type="submit">Filter</Button>
	</form>

	<p class="meta">Showing {data.items.length} of {data.total} — page {data.page} of {data.totalPages}</p>

	{#if data.items.length === 0}
		<p class="muted">No comments match these filters.</p>
	{:else}
		<ul class="list">
			{#each data.items as c (c.id)}
				<li class="comment" class:moderated={c.status !== 'visible'}>
					<div class="head">
						<strong>{c.authorEmail}</strong>
						<span class="post">post: <code>{c.postId}</code> · {c.locale}</span>
						<time>{new Date(c.createdAt).toLocaleString()}</time>
						<span class="badge">{c.status}</span>
					</div>
					<p class="body">{c.body}</p>
					{#if c.hiddenReason}<p class="reason">Reason: {c.hiddenReason}</p>{/if}
					<div class="actions">
						{#if c.status === 'visible'}
							<form method="POST" action="?/hide" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<Button type="submit" variant="ghost">Hide</Button>
							</form>
						{:else if c.status === 'hidden'}
							<form method="POST" action="?/unhide" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<Button type="submit" variant="ghost">Restore</Button>
							</form>
						{/if}
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="id" value={c.id} />
							<Button type="submit" variant="ghost">Remove</Button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</Stack>

<style>
	.filters {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
	}
	.meta {
		color: var(--color-muted);
		font-size: 0.85rem;
	}
	.list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.comment {
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.comment.moderated {
		opacity: 0.7;
	}
	.head {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		align-items: baseline;
		font-size: 0.85rem;
		color: var(--color-muted);
	}
	.head strong {
		color: var(--color-fg);
	}
	.body {
		white-space: pre-wrap;
	}
	.reason {
		color: var(--color-muted);
		font-style: italic;
		margin: 0;
	}
	.actions {
		display: flex;
		gap: var(--spacing-2);
		margin-top: var(--spacing-2);
	}
	.badge {
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}
	.muted {
		color: var(--color-muted);
	}
	.post code {
		font-family: var(--font-mono);
	}
</style>
