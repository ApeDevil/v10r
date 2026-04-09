<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
const toast = getToast();

let submitting = $state('');
let deletePostId = $state('');
let showDeleteDialog = $state(false);
let unpublishPostId = $state('');
let showUnpublishDialog = $state(false);

function relativeTime(iso: string | null): string {
	if (!iso) return '—';
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

function statusVariant(status: string): 'success' | 'secondary' | 'warning' {
	if (status === 'published') return 'success';
	if (status === 'archived') return 'warning';
	return 'secondary';
}

function enhanceHandler(actionKey: string) {
	return () => {
		submitting = actionKey;
		return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
			if (result.type === 'success' && result.data) toast.success(result.data.message as string);
			else if (result.type === 'failure') toast.error((result.data?.message as string) || 'Failed');
			submitting = '';
			return update();
		};
	};
}

function submitHiddenForm(action: string, postId: string) {
	const form = document.createElement('form');
	form.method = 'POST';
	form.style.display = 'none';
	const input = document.createElement('input');
	input.name = 'postId';
	input.value = postId;
	form.appendChild(input);
	form.action = `?/${action}`;
	document.body.appendChild(form);
	form.submit();
}
</script>

<svelte:head>
	<title>Posts - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Post Management</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		<!-- Search & Filter Bar -->
		<div class="filter-bar">
			<form method="GET" class="search-form">
				<Input name="q" value={data.q} placeholder="Search posts..." />
				<input type="hidden" name="page" value="1" />
				{#if data.sort !== 'created'}<input type="hidden" name="sort" value={data.sort} />{/if}
				{#if data.dir !== 'desc'}<input type="hidden" name="dir" value={data.dir} />{/if}
				{#if data.statusFilter !== 'all'}<input type="hidden" name="status" value={data.statusFilter} />{/if}
				<Button type="submit" variant="outline" size="sm">Search</Button>
			</form>

			<div class="status-filters">
				<a href={buildUrl({ status: '', page: '1' })} class="filter-link" class:active={data.statusFilter === 'all'}>All</a>
				<a href={buildUrl({ status: 'draft', page: '1' })} class="filter-link" class:active={data.statusFilter === 'draft'}>Draft</a>
				<a href={buildUrl({ status: 'published', page: '1' })} class="filter-link" class:active={data.statusFilter === 'published'}>Published</a>
				<a href={buildUrl({ status: 'archived', page: '1' })} class="filter-link" class:active={data.statusFilter === 'archived'}>Archived</a>
			</div>
		</div>

		{#if data.posts.length === 0}
			{#if data.q || data.statusFilter !== 'all'}
				<EmptyState
					icon="i-lucide-search-x"
					title="No results"
					description={data.q ? `No posts match "${data.q}"` : 'No posts match these filters.'}
				>
					<a href="/admin/content/posts">
						<Button variant="outline" size="sm">Clear filters</Button>
					</a>
				</EmptyState>
			{:else}
				<EmptyState
					icon="i-lucide-file-text"
					title="No posts yet"
					description="Blog posts will appear here once they are created."
				/>
			{/if}
		{:else}
			<div class="table-wrap">
				<table class="post-table">
					<thead>
						<tr>
							<th>
								<a href={sortHref('title')} class="sort-header">
									Title <span class="{sortIcon('title')} sort-icon"></span>
								</a>
							</th>
							<th>Slug</th>
							<th>
								<a href={sortHref('status')} class="sort-header">
									Status <span class="{sortIcon('status')} sort-icon"></span>
								</a>
							</th>
							<th>Author</th>
							<th>Tags</th>
							<th>
								<a href={sortHref('published')} class="sort-header">
									Published <span class="{sortIcon('published')} sort-icon"></span>
								</a>
							</th>
							<th>
								<a href={sortHref('updated')} class="sort-header">
									Updated <span class="{sortIcon('updated')} sort-icon"></span>
								</a>
							</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.posts as p}
							<tr>
								<td class="title-cell">{p.title ?? '(untitled)'}</td>
								<td><code class="slug-code">{p.slug}</code></td>
								<td><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
								<td>{p.authorName ?? '—'}</td>
								<td>
									{#if p.tags.length > 0}
										<Cluster gap="1">
											{#each p.tags as t}
												<Badge variant="outline">{t.name}</Badge>
											{/each}
										</Cluster>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td class="time-cell" title={p.publishedAt ?? ''}>{relativeTime(p.publishedAt)}</td>
								<td class="time-cell" title={p.updatedAt}>{relativeTime(p.updatedAt)}</td>
								<td>
									<Cluster gap="1">
										{#if p.status === 'draft'}
											<form
												method="POST"
												action="?/publish"
												use:enhance={enhanceHandler(p.id + ':publish')}
											>
												<input type="hidden" name="postId" value={p.id} />
												<Button type="submit" variant="outline" size="sm" disabled={submitting === p.id + ':publish'}>
													{#if submitting === p.id + ':publish'}<Spinner size="xs" class="mr-1" />{/if}
													Publish
												</Button>
											</form>
										{/if}

										{#if p.status === 'published'}
											<Button
												variant="outline"
												size="sm"
												onclick={() => { unpublishPostId = p.id; showUnpublishDialog = true; }}
											>
												Unpublish
											</Button>
										{/if}

										{#if p.status !== 'archived'}
											<form
												method="POST"
												action="?/archive"
												use:enhance={enhanceHandler(p.id + ':archive')}
											>
												<input type="hidden" name="postId" value={p.id} />
												<Button type="submit" variant="ghost" size="sm" disabled={submitting === p.id + ':archive'}>
													{#if submitting === p.id + ':archive'}<Spinner size="xs" class="mr-1" />{/if}
													Archive
												</Button>
											</form>
										{/if}

										<Button
											variant="ghost"
											size="sm"
											onclick={() => { deletePostId = p.id; showDeleteDialog = true; }}
										>
											Delete
										</Button>
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

<!-- Delete Confirmation -->
<ConfirmDialog
	open={showDeleteDialog}
	title="Delete Post"
	description="This will soft-delete the post. It can be recovered from the database."
	confirmLabel="Delete"
	destructive
	onconfirm={() => {
		showDeleteDialog = false;
		submitHiddenForm('delete', deletePostId);
	}}
	oncancel={() => { showDeleteDialog = false; }}
/>

<!-- Unpublish Confirmation -->
<ConfirmDialog
	open={showUnpublishDialog}
	title="Unpublish Post"
	description="This will remove the post from the public site and set its status to archived."
	confirmLabel="Unpublish"
	destructive
	onconfirm={() => {
		showUnpublishDialog = false;
		submitHiddenForm('unpublish', unpublishPostId);
	}}
	oncancel={() => { showUnpublishDialog = false; }}
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

	.post-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.post-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.post-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.post-table tbody tr:hover {
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

	.title-cell {
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.slug-code {
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
</style>
