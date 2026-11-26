<script lang="ts">
import { Alert, Card, ConfirmDialog } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Button, Tag } from '#lib/components/primitives/index.ts';
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '#lib/feedback/category.ts';
import { feedbackCategoryLabel, feedbackCloseReasonLabel, feedbackStatusLabel } from '#lib/feedback/labels.ts';
import { FEEDBACK_STATUSES, type FeedbackStatus } from '#lib/feedback/status.ts';
import { formatRelative } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

let confirmPurgeOpen = $state(false);

const totalCount = $derived(Object.values(data.counts).reduce((sum, n) => sum + n, 0));
// Either bound reached means the public form is refusing new feedback right now.
const refusing = $derived(totalCount >= data.storage.ceiling || data.counts.received >= data.storage.inboxCapacity);
const nearCeiling = $derived(!refusing && totalCount >= data.storage.warnFrom);

function listHref(next: { status?: FeedbackStatus; category?: FeedbackCategory; offset?: number }) {
	const params = new URLSearchParams();
	if (next.status) params.set('status', next.status);
	if (next.category) params.set('category', next.category);
	if (next.offset) params.set('offset', String(next.offset));
	const query = params.toString();
	return query ? `?${query}` : '?';
}

function statusTagVariant(status: FeedbackStatus) {
	if (status === 'received') return 'default' as const;
	if (status === 'closed') return 'secondary' as const;
	return 'success' as const;
}
</script>
<Stack gap="6">
	<header>
		<h1 class="page-title">{m.admin_feedback_title()}</h1>
		<p class="page-lede">{m.admin_feedback_lede()}</p>
	</header>

	{#if refusing}
		<Alert
			variant="error"
			title={m.admin_feedback_storage_full({ stored: totalCount, ceiling: data.storage.ceiling, waiting: data.counts.received, capacity: data.storage.inboxCapacity })}
		/>
	{:else if nearCeiling}
		<Alert variant="warning" title={m.admin_feedback_storage_near({ stored: totalCount, ceiling: data.storage.ceiling })} />
	{/if}

	<nav class="filter-bar" aria-label={m.admin_feedback_filter_status()}>
		<a class="filter-link" class:active={!data.status} href={listHref({ category: data.category })}>
			{m.admin_filter_all()}
			<span class="filter-count">{totalCount}</span>
		</a>
		{#each FEEDBACK_STATUSES as status (status)}
			<a
				class="filter-link"
				class:active={data.status === status}
				href={listHref({ status, category: data.category })}
			>
				{feedbackStatusLabel(status)}
				<span class="filter-count">{data.counts[status]}</span>
			</a>
		{/each}
	</nav>

	<nav class="filter-bar" aria-label={m.admin_feedback_filter_category()}>
		<a class="filter-link" class:active={!data.category} href={listHref({ status: data.status })}>
			{m.admin_filter_all()}
		</a>
		{#each FEEDBACK_CATEGORIES as category (category)}
			<a
				class="filter-link"
				class:active={data.category === category}
				href={listHref({ status: data.status, category })}
			>
				{feedbackCategoryLabel(category)}
			</a>
		{/each}
	</nav>

	<Card>
		{#if data.items.length === 0}
			<p class="empty">
				{data.status ? m.admin_feedback_empty_filtered({ status: feedbackStatusLabel(data.status) }) : m.admin_feedback_empty_none()}
			</p>
		{:else}
			<div class="table-wrap" tabindex="0" aria-label={m.admin_feedback_title()}>
				<table class="feedback-table">
					<thead>
						<tr>
							<th>{m.admin_feedback_col_received()}</th>
							<th>{m.admin_feedback_col_subject()}</th>
							<th>{m.admin_feedback_col_category()}</th>
							<th>{m.admin_feedback_col_page()}</th>
							<th>{m.admin_feedback_col_status()}</th>
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
								<td>
									<a href={`/admin/feedback/${item.id}`} class="row-link">{item.subject || m.admin_feedback_erased_subject()}</a>
									{#if item.signedIn}
										<span class="i-lucide-user muted" aria-label={m.admin_feedback_signed_in()}></span>
									{/if}
								</td>
								<td>{feedbackCategoryLabel(item.category)}</td>
								<td><code class="page-cell">{item.routeId || item.pageOfOrigin || '—'}</code></td>
								<td>
									<Tag variant={statusTagVariant(item.status)} size="sm">
										{feedbackStatusLabel(item.status)}{#if item.closeReason}&nbsp;· {feedbackCloseReasonLabel(item.closeReason)}{/if}
									</Tag>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<div class="list-footer">
		{#if data.total > data.items.length}
			<p class="muted">{m.admin_feedback_showing_of_total({ shown: data.items.length, total: data.total })}</p>
		{/if}
		<div class="pager">
			{#if data.offset > 0}
				<Button variant="ghost" size="sm" href={listHref({ status: data.status, category: data.category, offset: Math.max(data.offset - data.limit, 0) })}>
					{m.admin_feedback_page_previous()}
				</Button>
			{/if}
			{#if data.offset + data.items.length < data.total}
				<Button variant="ghost" size="sm" href={listHref({ status: data.status, category: data.category, offset: data.offset + data.limit })}>
					{m.admin_feedback_page_next()}
				</Button>
			{/if}
		</div>
	</div>

	<Card>
		<div class="purge-row">
			<p class="muted">
				{m.admin_feedback_purge_description({ days: data.purgeDays })}
				{m.admin_feedback_storage_usage({ stored: totalCount, ceiling: data.storage.ceiling })}
			</p>
			<Button variant="outline" size="sm" onclick={() => (confirmPurgeOpen = true)}>{m.admin_feedback_purge_action()}</Button>
		</div>
	</Card>

	<ConfirmDialog
		bind:open={confirmPurgeOpen}
		title={m.admin_feedback_purge_dialog_title()}
		description={m.admin_feedback_purge_description({ days: data.purgeDays })}
		confirmLabel={m.admin_feedback_purge_action()}
		destructive
		onconfirm={async () => {
			await fetch('?/purge', { method: 'POST', body: new FormData(), headers: { 'x-requested-with': 'fetch' } });
			confirmPurgeOpen = false;
			await invalidateAll();
		}}
		oncancel={() => (confirmPurgeOpen = false)}
	/>
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

	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
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

	.list-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.pager {
		display: flex;
		gap: var(--spacing-2);
		margin-left: auto;
	}

	.purge-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.purge-row p {
		margin: 0;
	}
</style>
