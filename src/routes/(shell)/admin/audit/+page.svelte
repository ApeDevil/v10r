<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Select } from '$lib/components/primitives';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

let expandedId = $state<number | null>(null);

const hasFilters = $derived(
	data.filters.action || data.filters.actor || data.filters.targetType || data.filters.dateFrom || data.filters.dateTo,
);

function relativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function buildUrl(params: Record<string, string>): string {
	const u = new URL(page.url);
	for (const [k, v] of Object.entries(params)) {
		if (v) u.searchParams.set(k, v);
		else u.searchParams.delete(k);
	}
	return u.pathname + u.search;
}

function exportUrl(): string {
	const u = new URL(`${page.url.origin}/admin/audit/export`);
	if (data.filters.action) u.searchParams.set('action', data.filters.action);
	if (data.filters.actor) u.searchParams.set('actor', data.filters.actor);
	if (data.filters.targetType) u.searchParams.set('target_type', data.filters.targetType);
	if (data.filters.dateFrom) u.searchParams.set('from', data.filters.dateFrom);
	if (data.filters.dateTo) u.searchParams.set('to', data.filters.dateTo);
	return u.pathname + u.search;
}

function actionVariant(action: string): 'default' | 'secondary' | 'warning' | 'error' | 'success' {
	if (action.includes('delete') || action.includes('ban')) return 'error';
	if (action.includes('create')) return 'success';
	if (action.includes('toggle') || action.includes('update')) return 'warning';
	return 'secondary';
}
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Audit Log</h2>
				<Cluster gap="2">
					<a href={exportUrl()} download>
						<Button variant="outline" size="sm">
							<span class="i-lucide-download h-4 w-4 mr-1"></span>
							Export CSV
						</Button>
					</a>
					<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						Refresh
					</Button>
				</Cluster>
			</Cluster>
		{/snippet}

		<!-- Filter Bar -->
		<form method="GET" class="filter-bar">
			<div class="filter-field">
				<label class="filter-label" for="filter-action">Action</label>
				<select name="action" id="filter-action" class="filter-select">
					<option value="">All actions</option>
					{#each data.distinctActions as action}
						<option value={action} selected={data.filters.action === action}>{action}</option>
					{/each}
				</select>
			</div>
			<div class="filter-field">
				<label class="filter-label" for="filter-actor">Actor</label>
				<Input name="actor" id="filter-actor" value={data.filters.actor} placeholder="Email..." />
			</div>
			<div class="filter-field">
				<label class="filter-label" for="filter-from">From</label>
				<input type="date" name="from" id="filter-from" value={data.filters.dateFrom} class="filter-date" />
			</div>
			<div class="filter-field">
				<label class="filter-label" for="filter-to">To</label>
				<input type="date" name="to" id="filter-to" value={data.filters.dateTo} class="filter-date" />
			</div>
			<div class="filter-actions">
				<Button type="submit" variant="outline" size="sm">Filter</Button>
				{#if hasFilters}
					<a href="/admin/audit">
						<Button variant="ghost" size="sm">Clear</Button>
					</a>
				{/if}
			</div>
		</form>

		{#if data.entries.length === 0}
			{#if hasFilters}
				<EmptyState
					icon="i-lucide-search-x"
					title="No events match these filters"
					description="Try adjusting the filters or clearing them."
				>
					<a href="/admin/audit">
						<Button variant="outline" size="sm">Clear filters</Button>
					</a>
				</EmptyState>
			{:else}
				<EmptyState
					icon="i-lucide-shield-check"
					title="No audit events yet"
					description="Admin actions will appear here once they occur."
				/>
			{/if}
		{:else}
			<div class="table-wrap">
				<table class="audit-table">
					<thead>
						<tr>
							<th>Timestamp</th>
							<th>Action</th>
							<th>Actor</th>
							<th>Target</th>
							<th>Detail</th>
						</tr>
					</thead>
					<tbody>
						{#each data.entries as entry}
							<tr>
								<td class="time-cell" title={entry.occurredAt}>{relativeTime(entry.occurredAt)}</td>
								<td><Badge variant={actionVariant(entry.action)}>{entry.action}</Badge></td>
								<td><code class="actor-email">{entry.actorEmail}</code></td>
								<td>
									{#if entry.targetType}
										<span class="target">{entry.targetType}{#if entry.targetId}:{entry.targetId}{/if}</span>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td>
									{#if entry.detail}
										<button
											class="detail-toggle"
											onclick={() => { expandedId = expandedId === entry.id ? null : entry.id; }}
										>
											{expandedId === entry.id ? 'Hide' : 'Show'}
										</button>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
							</tr>
							{#if entry.detail && expandedId === entry.id}
								<tr class="detail-row">
									<td colspan="5">
										<pre class="detail-json">{JSON.stringify(entry.detail, null, 2)}</pre>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>

			{#if data.totalPages > 1}
				<div class="pagination">
					{#if data.page > 1}
						<a href={buildUrl({ page: String(data.page - 1) })} class="page-link">
							<span class="i-lucide-chevron-left h-4 w-4"></span> Prev
						</a>
					{/if}
					<span class="page-info">Page {data.page} of {data.totalPages}</span>
					{#if data.page < data.totalPages}
						<a href={buildUrl({ page: String(data.page + 1) })} class="page-link">
							Next <span class="i-lucide-chevron-right h-4 w-4"></span>
						</a>
					{/if}
				</div>
			{/if}
		{/if}
	</Card>
</Stack>

<style>
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		align-items: flex-end;
		margin-bottom: var(--spacing-4);
	}

	.filter-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 120px;
	}

	.filter-label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
	}

	.filter-select,
	.filter-date {
		padding: var(--spacing-1) var(--spacing-2);
		border: 1px solid var(--color-input-border);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-sm);
		background: var(--color-bg);
		color: var(--color-fg);
	}

	.filter-actions {
		display: flex;
		gap: var(--spacing-1);
		align-items: flex-end;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.audit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.audit-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.audit-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.audit-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.time-cell {
		color: var(--color-muted);
	}

	.actor-email {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.target {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.text-muted {
		color: var(--color-muted);
	}

	.detail-toggle {
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		font-size: var(--text-fluid-xs);
		padding: 0;
	}

	.detail-toggle:hover {
		text-decoration: underline;
	}

	.detail-row td {
		padding: 0 var(--spacing-3) var(--spacing-3);
		white-space: normal;
	}

	.detail-json {
		background: var(--color-subtle);
		border-radius: var(--radius-sm);
		padding: var(--spacing-3);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		overflow-x: auto;
		margin: 0;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
		margin-top: var(--spacing-4);
	}

	.page-link {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
		text-decoration: none;
	}

	.page-link:hover {
		text-decoration: underline;
	}

	.page-info {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
