<script lang="ts">
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import NRagPipelineDiagram from '$lib/components/admin/ai/NRagPipelineDiagram.svelte';
import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();
const toast = getToast();

const pipelineCounts = $derived({
	llmwiki: data.llmwiki.totalPages,
	rawrag: data.coverage.totalChunks,
	docs: data.bySource.find((s) => s.source === 'docs')?.count ?? 0,
	catalog: data.bySource.find((s) => s.source === 'catalog')?.count ?? 0,
});

let actionId = $state('');
let showDeleteDialog = $state(false);
let deleteDocId = $state('');
let deleteDocTitle = $state('');

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'secondary' {
	switch (status) {
		case 'ready':
			return 'success';
		case 'error':
			return 'error';
		case 'processing':
			return 'warning';
		default:
			return 'secondary';
	}
}

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

function confirmDelete(id: string, title: string) {
	deleteDocId = id;
	deleteDocTitle = title;
	showDeleteDialog = true;
}

function submitDelete() {
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = '?/deleteDocument';
	const input = document.createElement('input');
	input.type = 'hidden';
	input.name = 'documentId';
	input.value = deleteDocId;
	form.appendChild(input);
	document.body.appendChild(form);
	form.submit();
}

const statusFilters = ['all', 'pending', 'processing', 'ready', 'error'] as const;
</script>
<Stack gap="6">
	<!-- nRAG Pipeline -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">nRAG Pipeline</h2>
		{/snippet}
		<NRagPipelineDiagram
			counts={pipelineCounts}
			compileScaffold={data.llmwiki.compileScaffold}
			lintScaffold={data.llmwiki.lintScaffold}
		/>
	</Card>

	<!-- Overview -->
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<h2 class="text-fluid-lg font-semibold">RAG Overview</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		<div class="stat-grid">
			<div class="stat-card">
				<span class="stat-label">Documents</span>
				<span class="stat-value">{data.overview.totalDocuments}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Ready</span>
				<Cluster gap="2" align="center">
					<span class="stat-value">{data.overview.readyCount}</span>
					<Badge variant="success">ready</Badge>
				</Cluster>
			</div>
			<div class="stat-card">
				<span class="stat-label">Pending</span>
				<span class="stat-value">{data.overview.pendingCount + data.overview.processingCount}</span>
			</div>
			<div class="stat-card stat-card--error">
				<span class="stat-label">Errors</span>
				<Cluster gap="2" align="center">
					<span class="stat-value">{data.overview.errorCount}</span>
					{#if data.overview.errorCount > 0}
						<Badge variant="error">needs attention</Badge>
					{/if}
				</Cluster>
			</div>
			<div class="stat-card">
				<span class="stat-label">Total Chunks</span>
				<span class="stat-value">{data.overview.totalChunks.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Total Tokens</span>
				<span class="stat-value">{data.overview.totalTokens.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Collections</span>
				<span class="stat-value">{data.overview.totalCollections}</span>
			</div>
		</div>
	</Card>

	<!-- LLM-Wiki Health -->
	<Card>
		{#snippet header()}
			<Cluster gap="2" align="center">
				<span class="i-lucide-book-marked h-5 w-5"></span>
				<h2 class="text-fluid-lg font-semibold">LLM-Wiki Health</h2>
				{#if data.llmwiki.compileScaffold}
					<Badge variant="secondary">compiler scaffold</Badge>
				{/if}
			</Cluster>
		{/snippet}

		{#if data.llmwiki.totalPages === 0 && data.llmwiki.compileScaffold}
			<p class="scaffold-note">
				<span class="i-lucide-info h-4 w-4"></span>
				Compile pipeline not yet active — no wiki pages have been compiled. The llmwiki layer
				is the chatbot's primary answer surface once compilation is wired.
			</p>
		{:else}
			<div class="stat-grid">
				<div class="stat-card">
					<span class="stat-label">Pages</span>
					<span class="stat-value">{data.llmwiki.totalPages}</span>
				</div>
				<div class="stat-card">
					<span class="stat-label">Overview / Content</span>
					<span class="stat-value">{data.llmwiki.overviewPages} / {data.llmwiki.contentPages}</span>
				</div>
				<div class="stat-card">
					<span class="stat-label">Stale</span>
					<span class="stat-value">{data.llmwiki.stalePages}</span>
				</div>
				<div class="stat-card">
					<span class="stat-label">Links</span>
					<span class="stat-value">{data.llmwiki.totalLinks}</span>
				</div>
				<div class="stat-card" class:stat-card--error={data.llmwiki.brokenLinks > 0}>
					<span class="stat-label">Broken Links</span>
					<span class="stat-value">{data.llmwiki.brokenLinks}</span>
				</div>
				<div class="stat-card">
					<span class="stat-label">Redirects</span>
					<span class="stat-value">{data.llmwiki.totalRedirects}</span>
				</div>
			</div>
		{/if}

		<div class="lint-row">
			<span class="lint-label">Lint:</span>
			{#if data.llmwiki.lintScaffold}
				<span class="muted">Lint runner not yet active — issue counts are not yet meaningful.</span>
			{:else if data.llmwiki.openLintIssues === 0}
				<Badge variant="success">No open issues</Badge>
			{:else}
				{#each Object.entries(data.llmwiki.lintBySeverity) as [sev, n]}
					<Badge variant={sev === 'error' ? 'error' : sev === 'warn' ? 'warning' : 'secondary'}>
						{n} {sev}
					</Badge>
				{/each}
			{/if}
		</div>
	</Card>

	<!-- Knowledge Graph -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Knowledge Graph</h2>
		{/snippet}

		{#if data.graph === null}
			<p class="scaffold-note">
				<span class="i-lucide-unplug h-4 w-4"></span>
				Graph unavailable — the Neo4j (Aura) connection did not respond.
			</p>
		{:else}
			<div class="stat-grid">
				<div class="stat-card">
					<span class="stat-label">Entity Nodes</span>
					<span class="stat-value">{data.graph.nodes.toLocaleString()}</span>
				</div>
				<div class="stat-card">
					<span class="stat-label">Relationships</span>
					<span class="stat-value">{data.graph.edges.toLocaleString()}</span>
				</div>
				<div class="stat-card">
					<span class="stat-label">Embedded Chunks</span>
					<span class="stat-value">{data.coverage.embeddedChunks.toLocaleString()} / {data.coverage.totalChunks.toLocaleString()}</span>
				</div>
			</div>
		{/if}
	</Card>

	<!-- Needs Attention -->
	{#if data.errorDocs.length > 0}
		<Card>
			{#snippet header()}
				<Cluster gap="2" align="center">
					<span class="i-lucide-alert-triangle h-5 w-5 text-error"></span>
					<h2 class="text-fluid-lg font-semibold">Needs Attention</h2>
					<Badge variant="error">{data.errorDocs.length}</Badge>
				</Cluster>
			{/snippet}

			<div class="error-list">
				{#each data.errorDocs as doc}
					<div class="error-item">
						<div class="error-item-info">
							<span class="error-item-title">{doc.title}</span>
							<span class="error-item-meta">
								{doc.userEmail ?? 'Unknown user'} &middot; {doc.source}
							</span>
							{#if doc.errorMessage}
								<code class="error-item-message">{doc.errorMessage}</code>
							{/if}
						</div>
						<Cluster gap="2">
							<form
								method="POST"
								action="?/resetDocument"
								use:enhance={() => {
									actionId = doc.id;
									return async ({ result, update }) => {
										if (result.type === 'success' && result.data) {
											toast.success(result.data.message as string);
										} else if (result.type === 'failure') {
											toast.error((result.data?.message as string) || 'Reset failed.');
										}
										actionId = '';
										return update();
									};
								}}
							>
								<input type="hidden" name="documentId" value={doc.id} />
								<Button type="submit" variant="outline" size="sm" disabled={actionId === doc.id}>
									{#if actionId === doc.id}
										<Spinner size="xs" class="mr-1" />
									{/if}
									Reset
								</Button>
							</form>
							<Button
								variant="destructive"
								size="sm"
								onclick={() => confirmDelete(doc.id, doc.title)}
							>
								Delete
							</Button>
						</Cluster>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Documents -->
	{#await data.documents}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Documents</h2>
			{/snippet}
			<div class="skeleton-table"></div>
		</Card>
	{:then docData}
		<Card>
			{#snippet header()}
				<Cluster justify="between" align="center">
					<h2 class="text-fluid-lg font-semibold">Documents</h2>
					<div class="filter-bar">
						{#each statusFilters as s}
							<a
								href="/admin/ai/nrag?status={s}"
								class="filter-link"
								class:active={data.filters.status === s}
							>{s}</a>
						{/each}
					</div>
				</Cluster>
			{/snippet}

			{#if docData.entries.length === 0}
				<EmptyState
					icon="i-lucide-file-text"
					title={data.filters.status !== 'all' ? `No ${data.filters.status} documents` : 'No documents'}
					description={data.filters.status !== 'all' ? 'No documents match this filter.' : 'No RAG documents have been ingested.'}
				>
					{#if data.filters.status !== 'all'}
						<a href="/admin/ai/nrag">
							<Button variant="outline">Clear filter</Button>
						</a>
					{/if}
				</EmptyState>
			{:else}
				<div class="table-wrap" tabindex="0" aria-label="Documents">
					<table class="data-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Source</th>
								<th>Status</th>
								<th>Chunks</th>
								<th>Tokens</th>
								<th>User</th>
								<th>Created</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each docData.entries as doc}
								<tr class:error-row={doc.status === 'error'}>
									<td class="title-cell">{doc.title}</td>
									<td><Badge variant="secondary">{doc.source}</Badge></td>
									<td><Badge variant={statusVariant(doc.status)}>{doc.status}</Badge></td>
									<td><code>{doc.totalChunks}</code></td>
									<td><code>{doc.totalTokens.toLocaleString()}</code></td>
									<td class="user-cell">{doc.userEmail ?? '—'}</td>
									<td class="time-cell">{relativeTime(doc.createdAt)}</td>
									<td>
										<Cluster gap="1">
											{#if doc.status === 'error'}
												<form
													method="POST"
													action="?/resetDocument"
													use:enhance={() => {
														actionId = doc.id;
														return async ({ result, update }) => {
															if (result.type === 'success' && result.data) {
																toast.success(result.data.message as string);
															} else if (result.type === 'failure') {
																toast.error((result.data?.message as string) || 'Reset failed.');
															}
															actionId = '';
															return update();
														};
													}}
												>
													<input type="hidden" name="documentId" value={doc.id} />
													<Button type="submit" variant="ghost" size="sm" disabled={actionId === doc.id}>
														{#if actionId === doc.id}
															<Spinner size="xs" />
														{:else}
															<span class="i-lucide-rotate-ccw h-3 w-3"></span>
														{/if}
													</Button>
												</form>
											{/if}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => confirmDelete(doc.id, doc.title)}
											>
												<span class="i-lucide-trash-2 h-3 w-3"></span>
											</Button>
										</Cluster>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if docData.totalPages > 1}
					<div class="pagination">
						{#if data.filters.page > 1}
							<a
								href="/admin/ai/nrag?page={data.filters.page - 1}&status={data.filters.status}"
								class="page-link"
							>
								<span class="i-lucide-chevron-left h-4 w-4"></span> Prev
							</a>
						{/if}
						<span class="page-info">Page {data.filters.page} of {docData.totalPages}</span>
						{#if data.filters.page < docData.totalPages}
							<a
								href="/admin/ai/nrag?page={data.filters.page + 1}&status={data.filters.status}"
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
				<h2 class="text-fluid-lg font-semibold">Documents</h2>
			{/snippet}
			<p class="error-text">Failed to load documents.</p>
		</Card>
	{/await}

	<!-- Collections -->
	{#await data.collections}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Collections</h2>
			{/snippet}
			<div class="skeleton-table"></div>
		</Card>
	{:then collections}
		{#if collections.length > 0}
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Collections</h2>
				{/snippet}

				<div class="collection-grid">
					{#each collections as col}
						<div class="collection-card">
							<div class="collection-header">
								<span class="collection-name">{col.name}</span>
								<Badge variant="secondary">{col.documentCount} docs</Badge>
							</div>
							{#if col.description}
								<p class="collection-desc">{col.description}</p>
							{/if}
							<span class="collection-meta">{col.userEmail} &middot; {relativeTime(col.createdAt)}</span>
						</div>
					{/each}
				</div>
			</Card>
		{/if}
	{:catch}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Collections</h2>
			{/snippet}
			<p class="error-text">Failed to load collections.</p>
		</Card>
	{/await}
</Stack>

<ConfirmDialog
	open={showDeleteDialog}
	title="Delete Document"
	description="Delete &quot;{deleteDocTitle}&quot;? This will remove the document and all its chunks. This action cannot be undone."
	confirmLabel="Delete"
	destructive
	onconfirm={submitDelete}
	oncancel={() => { showDeleteDialog = false; }}
/>

<style>
	/* Stat Grid */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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

	.stat-card--error {
		border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
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

	.scaffold-note {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.lint-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.lint-label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
	}

	.muted {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	/* Error List */
	.error-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.error-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
		padding: var(--spacing-3);
		border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error) 5%, transparent);
	}

	.error-item-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.error-item-title {
		font-weight: 600;
	}

	.error-item-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.error-item-message {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-error);
		word-break: break-all;
		white-space: pre-wrap;
	}

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

	.error-row {
		background: color-mix(in srgb, var(--color-error) 5%, transparent);
	}

	.title-cell {
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-cell {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.time-cell {
		color: var(--color-muted);
	}

	/* Collections */
	.collection-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: var(--spacing-3);
	}

	.collection-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.collection-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.collection-name {
		font-weight: 600;
	}

	.collection-desc {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.collection-meta {
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
		text-transform: capitalize;
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

	.text-error {
		color: var(--color-error);
	}
</style>
