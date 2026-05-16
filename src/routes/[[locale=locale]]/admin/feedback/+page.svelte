<script lang="ts">
import { enhance } from '$app/forms';
import { page } from '$app/state';
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Tag } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data }: PageProps = $props();

const statusFilters = $derived<
	Array<{
		value: '' | 'new' | 'read' | 'archived';
		label: string;
		key: 'new' | 'read' | 'archived' | null;
	}>
>([
	{ value: '', label: m.admin_filter_all(), key: null },
	{ value: 'new', label: m.admin_status_new(), key: 'new' },
	{ value: 'read', label: m.admin_status_read(), key: 'read' },
	{ value: 'archived', label: m.admin_status_archived(), key: 'archived' },
]);

function statusTagVariant(status: string) {
	if (status === 'new') return 'default' as const;
	if (status === 'read') return 'success' as const;
	return 'secondary' as const;
}

function statusLabel(status: string): string {
	if (status === 'new') return m.admin_status_new();
	if (status === 'read') return m.admin_status_read();
	if (status === 'archived') return m.admin_status_archived();
	return status;
}
</script>
<Stack gap="6">
	<header>
		<h1 class="page-title">{m.admin_feedback_title()}</h1>
		<p class="page-lede">{m.admin_feedback_lede()}</p>
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
			<p class="empty">{data.status ? m.admin_feedback_empty_filtered({ status: statusLabel(data.status) }) : m.admin_feedback_empty_none()}</p>
		{:else}
			<table class="feedback-table">
				<thead>
					<tr>
						<th>{m.admin_feedback_col_received()}</th>
						<th>{m.admin_feedback_col_subject()}</th>
						<th>{m.admin_feedback_col_rating()}</th>
						<th>{m.admin_feedback_col_page()}</th>
						<th>{m.admin_feedback_col_journey()}</th>
						<th>{m.admin_feedback_col_status()}</th>
						<th aria-label={m.admin_feedback_col_actions()}></th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as item (item.id)}
						<tr>
							<td>
								<a href={`/admin/feedback/${item.id}`} class="row-link">
									{formatRelative(item.submittedAt, page.data.locale)}
								</a>
							</td>
							<td>{item.subject}</td>
							<td>{item.rating ?? '—'}</td>
							<td><code class="page-cell">{item.pageOfOrigin}</code></td>
							<td>
								{#if item.sessionId}
									<span class="i-lucide-link-2" aria-label={m.admin_feedback_journey_linked()}></span>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td>
								<Tag variant={statusTagVariant(item.status)} size="sm">{statusLabel(item.status)}</Tag>
							</td>
							<td>
								<form method="POST" action="?/updateStatus" use:enhance class="inline-form">
									<input type="hidden" name="id" value={item.id} />
									{#if item.status === 'new'}
										<Button type="submit" name="status" value="read" variant="ghost" size="sm">{m.admin_feedback_mark_read()}</Button>
									{:else if item.status === 'read'}
										<Button type="submit" name="status" value="archived" variant="ghost" size="sm">{m.admin_action_archive()}</Button>
									{:else}
										<Button type="submit" name="status" value="new" variant="ghost" size="sm">{m.admin_action_reopen()}</Button>
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
		<p class="muted">{m.admin_feedback_showing_of_total({ shown: data.items.length, total: data.total })}</p>
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
