<script lang="ts">
import { invalidateAll } from '$app/navigation';
import VolumeBarChart from '$lib/components/admin/ai/VolumeBarChart.svelte';
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';

let { data } = $props();

function relativeTime(date: Date): string {
	const diff = Date.now() - new Date(date).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function limitBadgeVariant(pct: number): 'success' | 'warning' | 'error' {
	if (pct >= 90) return 'error';
	if (pct >= 70) return 'warning';
	return 'success';
}
</script>
<Stack gap="6">
	<!-- Users Near Limit -->
	{#if data.usersNearLimit.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Users Near Conversation Limit</h2>
			{/snippet}

			<div class="table-wrap" tabindex="0" aria-label="Users near conversation limit">
				<table class="data-table">
					<thead>
						<tr>
							<th>User</th>
							<th>Conversations</th>
							<th>Usage</th>
						</tr>
					</thead>
					<tbody>
						{#each data.usersNearLimit as u}
							<tr>
								<td>
									<span class="user-name">{u.name}</span>
									<span class="user-email">{u.email}</span>
								</td>
								<td><code>{u.conversationCount} / 50</code></td>
								<td>
									<Badge variant={limitBadgeVariant(u.percentageUsed)}>
										{u.percentageUsed}%
									</Badge>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}

	<!-- Top Users -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Top Users</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		{#if data.topUsers.length === 0}
			<EmptyState
				icon="i-lucide-users"
				title="No conversations yet"
				description="No users have started AI conversations."
			/>
		{:else}
			<div class="table-wrap" tabindex="0" aria-label="Top users by conversations">
				<table class="data-table">
					<thead>
						<tr>
							<th>User</th>
							<th>Conversations</th>
							<th>Messages</th>
						</tr>
					</thead>
					<tbody>
						{#each data.topUsers as u}
							<tr>
								<td>
									<span class="user-name">{u.name}</span>
									<span class="user-email">{u.email}</span>
								</td>
								<td><code>{u.conversationCount}</code></td>
								<td><code>{u.messageCount}</code></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<!-- Message Volume -->
	{#await data.messageVolume}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Message Volume (30 days)</h2>
			{/snippet}
			<div class="skeleton-chart"></div>
		</Card>
	{:then volume}
		{#if volume.length > 0}
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Message Volume (30 days)</h2>
				{/snippet}

				<VolumeBarChart data={volume} caption="Messages per day over the last 30 days" unit="messages" />
			</Card>
		{/if}
	{:catch}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Message Volume (30 days)</h2>
			{/snippet}
			<p class="error-text">Failed to load message volume data.</p>
		</Card>
	{/await}

	<!-- Conversations List -->
	{#await data.conversations}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Conversations</h2>
			{/snippet}
			<div class="skeleton-table"></div>
		</Card>
	{:then convData}
		<Card>
			{#snippet header()}
				<Cluster justify="between" align="center">
					<h2 class="text-fluid-lg font-semibold">Conversations</h2>
					{#if data.filters.userId}
						<a href="/admin/ai/usage" class="filter-link active">Clear filter</a>
					{/if}
				</Cluster>
			{/snippet}

			{#if convData.entries.length === 0}
				<EmptyState
					icon="i-lucide-message-square"
					title={data.filters.userId ? 'No conversations for this user' : 'No conversations yet'}
					description={data.filters.userId ? 'This user has no AI conversations.' : 'No AI conversations have been created.'}
				>
					{#if data.filters.userId}
						<a href="/admin/ai/usage">
							<Button variant="outline">Clear filter</Button>
						</a>
					{/if}
				</EmptyState>
			{:else}
				<div class="table-wrap" tabindex="0" aria-label="Conversations">
					<table class="data-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>User</th>
								<th>Messages</th>
								<th>Created</th>
								<th>Updated</th>
							</tr>
						</thead>
						<tbody>
							{#each convData.entries as conv}
								<tr>
									<td class="title-cell">{conv.title}</td>
									<td>
										<a href="/admin/ai/usage?user={conv.userId}" class="user-link">
											{conv.userEmail}
										</a>
									</td>
									<td><code>{conv.messageCount}</code></td>
									<td class="time-cell">{relativeTime(conv.createdAt)}</td>
									<td class="time-cell">{relativeTime(conv.updatedAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if convData.totalPages > 1}
					<div class="pagination">
						{#if data.filters.page > 1}
							<a
								href="/admin/ai/usage?page={data.filters.page - 1}{data.filters.userId ? `&user=${data.filters.userId}` : ''}"
								class="page-link"
							>
								<span class="i-lucide-chevron-left h-4 w-4"></span> Prev
							</a>
						{/if}
						<span class="page-info">Page {data.filters.page} of {convData.totalPages}</span>
						{#if data.filters.page < convData.totalPages}
							<a
								href="/admin/ai/usage?page={data.filters.page + 1}{data.filters.userId ? `&user=${data.filters.userId}` : ''}"
								class="page-link"
							>
								Next <span class="i-lucide-chevron-right h-4 w-4"></span>
							</a>
						{/if}
					</div>
				{/if}
			{/if}
		</Card>
	{:catch}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Conversations</h2>
			{/snippet}
			<p class="error-text">Failed to load conversations.</p>
		</Card>
	{/await}
</Stack>

<style>
	/* Tables */
	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
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

	.user-name {
		font-weight: 500;
		display: block;
	}

	.user-email {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.user-link {
		color: var(--color-primary);
		text-decoration: none;
		font-size: var(--text-fluid-xs);
	}

	.user-link:hover {
		text-decoration: underline;
	}

	.title-cell {
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.time-cell {
		color: var(--color-muted);
	}

	/* Skeleton */
	.skeleton-chart {
		height: 120px;
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		animation: pulse 1.5s ease-in-out infinite;
	}

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

	@media (prefers-reduced-motion: reduce) {
		.skeleton-chart,
		.skeleton-table {
			animation: none;
			opacity: 0.6;
		}
	}

	.error-text {
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
		margin: 0;
	}

	/* Filter */
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
