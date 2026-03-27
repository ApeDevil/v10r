<script lang="ts">
import { enhance } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
const toast = getToast();

let banUserId = $state('');
let banReason = $state('');
let showBanDialog = $state(false);
let submitting = $state('');

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

function sortHref(col: string): string {
	const newDir = data.sort === col && data.dir === 'asc' ? 'desc' : 'asc';
	return buildUrl({ sort: col, dir: newDir, page: '1' });
}

function sortIcon(col: string): string {
	if (data.sort !== col) return 'i-lucide-chevrons-up-down';
	return data.dir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down';
}

function openBanDialog(userId: string) {
	banUserId = userId;
	banReason = '';
	showBanDialog = true;
}
</script>

<svelte:head>
	<title>Users - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">User Management</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		<!-- Search & Filter Bar -->
		<div class="filter-bar">
			<form method="GET" class="search-form">
				<Input name="q" value={data.q} placeholder="Search by name or email..." />
				<input type="hidden" name="page" value="1" />
				{#if data.sort !== 'createdAt'}<input type="hidden" name="sort" value={data.sort} />{/if}
				{#if data.dir !== 'desc'}<input type="hidden" name="dir" value={data.dir} />{/if}
				{#if data.statusFilter !== 'all'}<input type="hidden" name="status" value={data.statusFilter} />{/if}
				<Button type="submit" variant="outline" size="sm">Search</Button>
			</form>

			<div class="status-filters">
				<a href={buildUrl({ status: '', page: '1' })} class="filter-link" class:active={data.statusFilter === 'all'}>All</a>
				<a href={buildUrl({ status: 'active', page: '1' })} class="filter-link" class:active={data.statusFilter === 'active'}>Active</a>
				<a href={buildUrl({ status: 'banned', page: '1' })} class="filter-link" class:active={data.statusFilter === 'banned'}>Banned</a>
			</div>
		</div>

		{#if data.users.length === 0}
			{#if data.q || data.statusFilter !== 'all'}
				<EmptyState
					icon="i-lucide-search-x"
					title="No results"
					description={data.q ? `No users match "${data.q}"` : 'No users match these filters.'}
				>
					<a href="/admin/users">
						<Button variant="outline" size="sm">Clear filters</Button>
					</a>
				</EmptyState>
			{:else}
				<EmptyState
					icon="i-lucide-users"
					title="No users yet"
					description="Users will appear here once they register."
				/>
			{/if}
		{:else}
			<div class="table-wrap">
				<table class="user-table">
					<thead>
						<tr>
							<th>
								<a href={sortHref('name')} class="sort-header">
									Name <span class="{sortIcon('name')} sort-icon"></span>
								</a>
							</th>
							<th>
								<a href={sortHref('email')} class="sort-header">
									Email <span class="{sortIcon('email')} sort-icon"></span>
								</a>
							</th>
							<th>Role</th>
							<th>Status</th>
							<th>
								<a href={sortHref('createdAt')} class="sort-header">
									Created <span class="{sortIcon('createdAt')} sort-icon"></span>
								</a>
							</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.users as u}
							<tr>
								<td>
									<Cluster gap="2" align="center">
										{#if u.image}
											<img src={u.image} alt="" class="user-avatar" />
										{:else}
											<span class="user-avatar-placeholder i-lucide-user"></span>
										{/if}
										<span>{u.name}</span>
									</Cluster>
								</td>
								<td><code class="user-email">{u.email}</code></td>
								<td><Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge></td>
								<td>
									{#if u.banned}
										<Badge variant="error">Banned</Badge>
									{:else}
										<Badge variant="success">Active</Badge>
									{/if}
								</td>
								<td class="time-cell" title={u.createdAt}>{relativeTime(u.createdAt)}</td>
								<td>
									<Cluster gap="1">
										{#if u.banned}
											<form
												method="POST"
												action="?/unban"
												use:enhance={() => {
													submitting = u.id;
													return async ({ result, update }) => {
														if (result.type === 'success' && result.data) toast.success(result.data.message as string);
														else if (result.type === 'failure') toast.error((result.data?.message as string) || 'Failed');
														submitting = '';
														return update();
													};
												}}
											>
												<input type="hidden" name="userId" value={u.id} />
												<Button type="submit" variant="outline" size="sm" disabled={submitting === u.id}>
													{#if submitting === u.id}<Spinner size="xs" class="mr-1" />{/if}
													Unban
												</Button>
											</form>
										{:else}
											<Button variant="outline" size="sm" onclick={() => openBanDialog(u.id)}>
												Ban
											</Button>
										{/if}

										{#if u.role !== 'admin'}
											<form
												method="POST"
												action="?/setRole"
												use:enhance={() => {
													submitting = u.id + ':role';
													return async ({ result, update }) => {
														if (result.type === 'success' && result.data) toast.success(result.data.message as string);
														else if (result.type === 'failure') toast.error((result.data?.message as string) || 'Failed');
														submitting = '';
														return update();
													};
												}}
											>
												<input type="hidden" name="userId" value={u.id} />
												<input type="hidden" name="role" value="admin" />
												<Button type="submit" variant="ghost" size="sm" disabled={submitting === u.id + ':role'}>
													Promote
												</Button>
											</form>
										{:else}
											<form
												method="POST"
												action="?/setRole"
												use:enhance={() => {
													submitting = u.id + ':role';
													return async ({ result, update }) => {
														if (result.type === 'success' && result.data) toast.success(result.data.message as string);
														else if (result.type === 'failure') toast.error((result.data?.message as string) || 'Failed');
														submitting = '';
														return update();
													};
												}}
											>
												<input type="hidden" name="userId" value={u.id} />
												<input type="hidden" name="role" value="user" />
												<Button type="submit" variant="ghost" size="sm" disabled={submitting === u.id + ':role'}>
													Demote
												</Button>
											</form>
										{/if}
									</Cluster>
								</td>
							</tr>
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

<!-- Ban Confirmation Dialog -->
<ConfirmDialog
	open={showBanDialog}
	title="Ban User"
	description="This will revoke all active sessions for this user."
	confirmLabel="Ban"
	destructive
	onconfirm={() => {
		showBanDialog = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.style.display = 'none';
		const input = document.createElement('input');
		input.name = 'userId';
		input.value = banUserId;
		form.appendChild(input);
		form.action = '?/ban';
		document.body.appendChild(form);
		form.submit();
	}}
	oncancel={() => { showBanDialog = false; }}
/>

<style>
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-4);
	}

	.search-form {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex: 1;
		min-width: 200px;
		max-width: 400px;
	}

	.status-filters {
		display: flex;
		gap: var(--spacing-1);
	}

	.filter-link {
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
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

	.table-wrap {
		overflow-x: auto;
	}

	.user-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.user-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.user-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.user-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.sort-header {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		color: inherit;
		text-decoration: none;
	}

	.sort-header:hover {
		color: var(--color-fg);
	}

	.sort-icon {
		font-size: 0.75rem;
		opacity: 0.5;
	}

	.user-avatar {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
		object-fit: cover;
	}

	.user-avatar-placeholder {
		width: 24px;
		height: 24px;
		color: var(--color-muted);
	}

	.user-email {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.time-cell {
		color: var(--color-muted);
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

	.ban-reason-label {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin-top: var(--spacing-3);
	}

	.ban-reason-text {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
