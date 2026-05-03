<script lang="ts">
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();

function formatTtl(seconds: number): string {
	if (seconds === -2) return m.admin_cache_ttl_expired();
	if (seconds === -1) return m.admin_cache_ttl_no_expiry();
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const h = Math.floor(seconds / 3600);
	const min = Math.floor((seconds % 3600) / 60);
	return min > 0 ? `${h}h ${min}m` : `${h}h`;
}
const toast = getToast();

let actionKey = $state('');
let showDeleteDialog = $state(false);
let deleteKeyName = $state('');
let showFlushDialog = $state(false);
let flushPrefix = $state('');
let showInvalidateDialog = $state(false);
let expandedKey = $state<string | null>(null);
let inspectedValues = $state<Record<string, unknown>>({});
let inspecting = $state('');

function typeVariant(type: string): 'default' | 'success' | 'warning' | 'error' | 'secondary' {
	switch (type) {
		case 'string':
			return 'default';
		case 'hash':
			return 'success';
		case 'list':
			return 'warning';
		case 'set':
			return 'secondary';
		case 'zset':
			return 'error';
		default:
			return 'secondary';
	}
}

function thresholdVariant(threshold: string): 'success' | 'warning' | 'error' {
	switch (threshold) {
		case 'warning':
			return 'warning';
		case 'error':
			return 'error';
		default:
			return 'success';
	}
}

function confirmDelete(key: string) {
	deleteKeyName = key;
	showDeleteDialog = true;
}

function submitDelete() {
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = '?/deleteKey';
	const input = document.createElement('input');
	input.type = 'hidden';
	input.name = 'key';
	input.value = deleteKeyName;
	form.appendChild(input);
	document.body.appendChild(form);
	form.submit();
}

function confirmFlush(prefix: string) {
	flushPrefix = prefix;
	showFlushDialog = true;
}

function submitFlush() {
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = '?/flushPrefix';
	const input = document.createElement('input');
	input.type = 'hidden';
	input.name = 'prefix';
	input.value = flushPrefix;
	form.appendChild(input);
	document.body.appendChild(form);
	form.submit();
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (typeof value === 'string') return value;
	return JSON.stringify(value, null, 2);
}

const prefixFilters = ['', 'showcase:', 'ratelimit:'] as const;
const prefixLabels = $derived<Record<string, string>>({
	'': m.admin_filter_all(),
	'showcase:': 'showcase:',
	'ratelimit:': 'ratelimit:',
});
</script>
<Stack gap="6">
	<!-- Stats -->
	{#if data.overview}
		<Card>
			{#snippet header()}
				<Cluster justify="between">
					<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_stats()}</h2>
					<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						{m.admin_action_refresh()}
					</Button>
				</Cluster>
			{/snippet}

			<div class="stat-grid">
				<div class="stat-card">
					<span class="stat-label">{m.admin_cache_stat_total_keys()}</span>
					<span class="stat-value">{data.overview.totalKeys}</span>
				</div>
				{#if data.overview.upstash.data}
					<div class="stat-card">
						<span class="stat-label">{m.admin_cache_stat_commands_monthly()}</span>
						<Cluster gap="2" align="center">
							<span class="stat-value">{data.overview.upstash.data.commandsPercentage}%</span>
							<Badge variant={thresholdVariant(data.overview.upstash.data.commandsThreshold)}>
								{data.overview.upstash.data.commandsThreshold}
							</Badge>
						</Cluster>
					</div>
					<div class="stat-card">
						<span class="stat-label">{m.admin_cache_stat_storage()}</span>
						<Cluster gap="2" align="center">
							<span class="stat-value">{data.overview.upstash.data.storagePercentage}%</span>
							<Badge variant={thresholdVariant(data.overview.upstash.data.storageThreshold)}>
								{data.overview.upstash.data.storageThreshold}
							</Badge>
						</Cluster>
					</div>
				{:else}
					<div class="stat-card">
						<span class="stat-label">{m.admin_cache_stat_upstash_metrics()}</span>
						<span class="stat-muted">{m.admin_cache_not_configured()}</span>
					</div>
				{/if}
			</div>

			{#if Object.keys(data.overview.keysByPrefix).length > 0}
				<div class="breakdown-section">
					<h3 class="breakdown-title">{m.admin_cache_breakdown_by_prefix()}</h3>
					<div class="breakdown-list">
						{#each Object.entries(data.overview.keysByPrefix).sort((a, b) => b[1] - a[1]) as [prefix, count]}
							<Cluster gap="2" align="center">
								<code class="breakdown-key">{prefix}</code>
								<Badge variant="secondary">{count}</Badge>
							</Cluster>
						{/each}
					</div>
				</div>
			{/if}

			{#if Object.keys(data.overview.keysByType).length > 0}
				<div class="breakdown-section">
					<h3 class="breakdown-title">{m.admin_cache_breakdown_by_type()}</h3>
					<div class="breakdown-list">
						{#each Object.entries(data.overview.keysByType).sort((a, b) => b[1] - a[1]) as [type, count]}
							<Cluster gap="2" align="center">
								<Badge variant={typeVariant(type)}>{type}</Badge>
								<span class="breakdown-count">{count}</span>
							</Cluster>
						{/each}
					</div>
				</div>
			{/if}
		</Card>
	{:else}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_stats()}</h2>
			{/snippet}
			<EmptyState
				icon="i-lucide-hard-drive"
				title={m.admin_cache_redis_unavailable_title()}
				description={m.admin_cache_redis_unavailable_desc()}
			/>
		</Card>
	{/if}

	<!-- In-Process Caches -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_in_process()}</h2>
				<form
					method="POST"
					action="?/invalidateInProcess"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success' && result.data) {
								toast.success(result.data.message as string);
							} else if (result.type === 'failure') {
								toast.error((result.data?.message as string) || m.admin_action_failed_generic());
							}
							showInvalidateDialog = false;
							return update();
						};
					}}
				>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => { showInvalidateDialog = true; }}
					>
						<span class="i-lucide-rotate-ccw h-3 w-3 mr-1"></span>
						{m.admin_cache_action_invalidate_all()}
					</Button>
				</form>
			</Cluster>
		{/snippet}

		<div class="in-process-grid">
			<div class="in-process-card">
				<span class="in-process-label">{m.admin_cache_inprocess_feature_flags()}</span>
				<Cluster gap="2" align="center">
					<code class="in-process-value">{data.inProcessStatus.flagsCacheSize}</code>
					<span class="in-process-unit">{m.admin_cache_entries_unit()}</span>
				</Cluster>
			</div>
			<div class="in-process-card">
				<span class="in-process-label">{m.admin_cache_inprocess_announcements()}</span>
				<Cluster gap="2" align="center">
					<code class="in-process-value">{data.inProcessStatus.announcementsCacheSize}</code>
					<span class="in-process-unit">{m.admin_cache_entries_unit()}</span>
				</Cluster>
			</div>
		</div>
	</Card>

	<!-- Key Browser -->
	{#await data.keys}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_key_browser()}</h2>
			{/snippet}
			<div class="skeleton-table"></div>
		</Card>
	{:then keyData}
		<Card>
			{#snippet header()}
				<Cluster justify="between" align="center">
					<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_key_browser()}</h2>
					<div class="filter-bar">
						{#each prefixFilters as p}
							<a
								href="/admin/cache{p ? `?prefix=${p}` : ''}"
								class="filter-link"
								class:active={data.filters.prefix === p}
							>{prefixLabels[p]}</a>
						{/each}
					</div>
				</Cluster>
			{/snippet}

			{#if keyData.entries.length === 0}
				<EmptyState
					icon="i-lucide-key"
					title={data.filters.prefix ? m.admin_cache_no_keys_prefix({ prefix: data.filters.prefix }) : m.admin_cache_no_keys()}
					description={data.filters.prefix ? m.admin_cache_no_keys_prefix_desc() : m.admin_cache_no_keys_desc()}
				>
					{#if data.filters.prefix}
						<a href="/admin/cache">
							<Button variant="outline">{m.admin_cache_action_clear_filter()}</Button>
						</a>
					{/if}
				</EmptyState>
			{:else}
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th>{m.admin_cache_col_key()}</th>
								<th>{m.admin_cache_col_type()}</th>
								<th>{m.admin_cache_col_ttl()}</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each keyData.entries as entry}
								<tr>
									<td><code class="key-name">{entry.key}</code></td>
									<td><Badge variant={typeVariant(entry.type)}>{entry.type}</Badge></td>
									<td class="ttl-cell">
										<code>{formatTtl(entry.ttl)}</code>
									</td>
									<td>
										<Cluster gap="1">
											<form
												method="POST"
												action="?/inspectKey"
												use:enhance={() => {
													inspecting = entry.key;
													return async ({ result, update }) => {
														if (result.type === 'success' && result.data?.detail) {
															const detail = result.data.detail as { value: unknown };
															inspectedValues = { ...inspectedValues, [entry.key]: detail.value };
															expandedKey = expandedKey === entry.key ? null : entry.key;
														} else if (result.type === 'failure') {
															toast.error((result.data?.message as string) || m.admin_cache_inspect_failed());
														}
														inspecting = '';
														await update({ reset: false });
													};
												}}
											>
												<input type="hidden" name="key" value={entry.key} />
												<Button
													type="submit"
													variant="ghost"
													size="sm"
													disabled={inspecting === entry.key}
												>
													{#if inspecting === entry.key}
														<Spinner size="xs" />
													{:else}
														<span class="i-lucide-eye h-3 w-3"></span>
													{/if}
												</Button>
											</form>
											<Button
												variant="ghost"
												size="sm"
												onclick={() => confirmDelete(entry.key)}
											>
												<span class="i-lucide-trash-2 h-3 w-3"></span>
											</Button>
										</Cluster>
									</td>
								</tr>
								{#if expandedKey === entry.key && entry.key in inspectedValues}
									<tr class="detail-row">
										<td colspan="4">
											<pre class="detail-json">{formatValue(inspectedValues[entry.key])}</pre>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				{#if keyData.totalPages > 1}
					<div class="pagination">
						{#if data.filters.page > 1}
							<a
								href="/admin/cache?page={data.filters.page - 1}{data.filters.prefix ? `&prefix=${data.filters.prefix}` : ''}"
								class="page-link"
							>
								<span class="i-lucide-chevron-left h-4 w-4"></span> {m.admin_cache_pagination_prev()}
							</a>
						{/if}
						<span class="page-info">{m.admin_cache_pagination_page_of({ page: data.filters.page, total: keyData.totalPages })}</span>
						{#if data.filters.page < keyData.totalPages}
							<a
								href="/admin/cache?page={data.filters.page + 1}{data.filters.prefix ? `&prefix=${data.filters.prefix}` : ''}"
								class="page-link"
							>
								{m.admin_cache_pagination_next()} <span class="i-lucide-chevron-right h-4 w-4"></span>
							</a>
						{/if}
					</div>
				{/if}
			{/if}
		</Card>
	{:catch}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_key_browser()}</h2>
			{/snippet}
			<p class="error-text">{m.admin_cache_error_load_keys()}</p>
		</Card>
	{/await}

	<!-- Flush Actions -->
	{#if data.overview}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.admin_cache_section_flush()}</h2>
			{/snippet}

			<div class="flush-actions">
				<div class="flush-action">
					<div class="flush-info">
						<span class="flush-label">{m.admin_cache_flush_showcase_label()}</span>
						<span class="flush-desc">{m.admin_cache_flush_showcase_desc()}</span>
					</div>
					<Button variant="outline" size="sm" onclick={() => confirmFlush('showcase:')}>
						<span class="i-lucide-trash h-3 w-3 mr-1"></span>
						{m.admin_cache_action_flush()}
					</Button>
				</div>
				<div class="flush-action flush-action--danger">
					<div class="flush-info">
						<span class="flush-label">{m.admin_cache_flush_ratelimit_label()}</span>
						<span class="flush-desc">{m.admin_cache_flush_ratelimit_desc()}</span>
					</div>
					<Button variant="destructive" size="sm" onclick={() => confirmFlush('ratelimit:')}>
						<span class="i-lucide-alert-triangle h-3 w-3 mr-1"></span>
						{m.admin_cache_action_flush()}
					</Button>
				</div>
			</div>
		</Card>
	{/if}
</Stack>

<ConfirmDialog
	open={showDeleteDialog}
	title={m.admin_cache_dialog_delete_key_title()}
	description={m.admin_cache_dialog_delete_key_desc({ key: deleteKeyName })}
	confirmLabel={m.admin_action_delete()}
	destructive
	onconfirm={submitDelete}
	oncancel={() => { showDeleteDialog = false; }}
/>

<ConfirmDialog
	open={showFlushDialog}
	title={m.admin_cache_dialog_flush_title()}
	description={m.admin_cache_dialog_flush_desc({ prefix: flushPrefix })}
	confirmLabel={m.admin_cache_action_flush()}
	destructive
	onconfirm={submitFlush}
	oncancel={() => { showFlushDialog = false; }}
/>

<ConfirmDialog
	open={showInvalidateDialog}
	title={m.admin_cache_dialog_invalidate_title()}
	description={m.admin_cache_dialog_invalidate_desc()}
	confirmLabel={m.admin_cache_action_invalidate()}
	onconfirm={() => {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/invalidateInProcess';
		document.body.appendChild(form);
		form.submit();
	}}
	oncancel={() => { showInvalidateDialog = false; }}
/>

<style>
	/* Stat Grid */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-4);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat-value {
		font-size: var(--text-fluid-lg);
		font-weight: 700;
		font-family: ui-monospace, monospace;
	}

	.stat-muted {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	/* Breakdown */
	.breakdown-section {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	.breakdown-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-2);
	}

	.breakdown-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
	}

	.breakdown-key {
		font-size: var(--text-fluid-xs);
	}

	.breakdown-count {
		font-size: var(--text-fluid-sm);
		font-family: ui-monospace, monospace;
	}

	/* In-Process */
	.in-process-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-3);
	}

	.in-process-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.in-process-label {
		font-weight: 500;
		font-size: var(--text-fluid-sm);
	}

	.in-process-value {
		font-size: var(--text-fluid-lg);
		font-weight: 700;
	}

	.in-process-unit {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* Tables */
	.table-wrap {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.data-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.data-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.data-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.key-name {
		font-size: var(--text-fluid-xs);
		word-break: break-all;
		white-space: normal;
	}

	.ttl-cell {
		color: var(--color-muted);
	}

	/* Detail Row */
	.detail-row td {
		padding: 0 var(--spacing-3) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
	}

	.detail-json {
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-sm);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
		max-height: 300px;
		overflow-y: auto;
	}

	/* Flush Actions */
	.flush-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.flush-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-4);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.flush-action--danger {
		border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
		background: color-mix(in srgb, var(--color-error) 3%, transparent);
	}

	.flush-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.flush-label {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
	}

	.flush-desc {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* Filter */
	.filter-bar {
		display: flex;
		gap: var(--spacing-1);
		flex-wrap: wrap;
	}

	.filter-link {
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		text-decoration: none;
	}

	.filter-link:hover {
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.filter-link.active {
		background: var(--color-fg);
		color: var(--color-bg);
	}

	/* Skeleton & Error */
	.skeleton-table {
		height: 200px;
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.error-text {
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
		margin: 0;
	}

	/* Pagination */
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
