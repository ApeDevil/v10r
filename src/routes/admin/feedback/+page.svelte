<script lang="ts">
import { enhance } from '$app/forms';
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Tag } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n/formatting';

let { data }: PageProps = $props();

const statusFilters: Array<{
	value: '' | 'new' | 'read' | 'archived';
	label: string;
	key: 'new' | 'read' | 'archived' | null;
}> = [
	{ value: '', label: 'All', key: null },
	{ value: 'new', label: 'New', key: 'new' },
	{ value: 'read', label: 'Read', key: 'read' },
	{ value: 'archived', label: 'Archived', key: 'archived' },
];

function statusTagVariant(status: string) {
	if (status === 'new') return 'default' as const;
	if (status === 'read') return 'success' as const;
	return 'secondary' as const;
}
</script>
<Stack gap="6">
	<header>
		<h1 class="page-title">Feedback</h1>
		<p class="page-lede">Submissions from <code>/feedback</code>. Click a row to view detail and journey.</p>
	</header>

	<div class="filter-bar">
		{#each statusFilters as f (f.value)}
			{@const count = f.key ? data.counts[f.key] : data.counts.new + data.counts.read + data.counts.archived}
			<a
				class="filter-link"
				class:active={(data.status ?? '') === f.value}
				href={f.value ? `?status=${f.value}` : '?'}
			>
				{f.label}
				<span class="filter-count">{count}</span>
			</a>
		{/each}
	</div>

	<Card>
		{#if data.items.length === 0}
			<p class="empty">No feedback {data.status ? `with status "${data.status}"` : 'yet'}.</p>
		{:else}
			<table class="feedback-table">
				<thead>
					<tr>
						<th>Received</th>
						<th>Subject</th>
						<th>Rating</th>
						<th>Page</th>
						<th>Journey</th>
						<th>Status</th>
						<th aria-label="Actions"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as item (item.id)}
						<tr>
							<td>
								<a href={`/admin/feedback/${item.id}`} class="row-link">
									{formatRelative(item.submittedAt)}
								</a>
							</td>
							<td>{item.subject}</td>
							<td>{item.rating ?? '—'}</td>
							<td><code class="page-cell">{item.pageOfOrigin}</code></td>
							<td>
								{#if item.sessionId}
									<span class="i-lucide-link-2" aria-label="Linked journey"></span>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td>
								<Tag variant={statusTagVariant(item.status)} size="sm">{item.status}</Tag>
							</td>
							<td>
								<form method="POST" action="?/updateStatus" use:enhance class="inline-form">
									<input type="hidden" name="id" value={item.id} />
									{#if item.status === 'new'}
										<Button type="submit" name="status" value="read" variant="ghost" size="sm">Mark read</Button>
									{:else if item.status === 'read'}
										<Button type="submit" name="status" value="archived" variant="ghost" size="sm">Archive</Button>
									{:else}
										<Button type="submit" name="status" value="new" variant="ghost" size="sm">Reopen</Button>
									{/if}
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card>

	{#if data.total > data.items.length}
		<p class="muted">Showing {data.items.length} of {data.total}.</p>
	{/if}
</Stack>

<style>
	.page-title {
		margin: 0 0 var(--spacing-1) 0;
		font-size: var(--text-fluid-2xl, 1.5rem);
		font-weight: 600;
	}

	.page-lede {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.filter-bar {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		align-items: center;
	}

	.filter-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-decoration: none;
	}

	.filter-link.active {
		background: var(--color-primary);
		color: var(--color-on-primary, white);
		border-color: var(--color-primary);
	}

	.filter-count {
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}

	.feedback-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.feedback-table th,
	.feedback-table td {
		padding: var(--spacing-2) var(--spacing-3);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.feedback-table th {
		font-weight: 600;
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
	}

	.row-link {
		color: var(--color-fg);
		text-decoration: none;
	}

	.row-link:hover {
		text-decoration: underline;
	}

	.page-cell {
		font-size: var(--text-fluid-xs);
	}

	.muted {
		color: var(--color-muted);
	}

	.empty {
		margin: 0;
		padding: var(--spacing-4);
		text-align: center;
		color: var(--color-muted);
	}

	.inline-form {
		display: inline;
	}
</style>
