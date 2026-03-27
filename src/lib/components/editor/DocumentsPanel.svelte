<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { Badge, Button, Spinner } from '$lib/components/primitives';
	import { getDockContext, getDeskBus } from '$lib/components/composites/dock';
	import type { PanelDefinition } from '$lib/components/composites/dock';

	let loading = $state(true);
	let posts = $state<
		{
			id: string;
			slug: string;
			status: string;
			title: string;
			updatedAt: string;
		}[]
	>([]);
	let creating = $state(false);
	let slugInput = $state('');
	let showNewForm = $state(false);
	let error = $state('');

	const dock = getDockContext();
	const bus = getDeskBus();

	async function fetchPosts() {
		loading = true;
		error = '';
		try {
			const res = await apiFetch('/api/blog/posts');
			if (!res.ok) throw new Error('Failed to load posts');
			const data = await res.json();
			posts = data.items;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			loading = false;
		}
	}

	function openPost(postId: string) {
		const editorPanelId = `editor-${postId}`;

		const panel: PanelDefinition = {
			id: editorPanelId,
			type: 'editor',
			label: 'Editor',
			icon: 'i-lucide-pen-line',
			closable: true,
		};
		dock.addPanel(panel);

		bus.publish('editor:document', { documentId: postId, type: 'blog-post' });
	}

	async function createNewPost() {
		const slug = slugInput.trim();
		if (!slug) return;
		creating = true;
		error = '';
		try {
			const res = await apiFetch('/api/blog/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data.message || 'Failed to create post');
			}
			const { post } = data;
			slugInput = '';
			showNewForm = false;
			await fetchPosts();
			openPost(post.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create';
		} finally {
			creating = false;
		}
	}

	function statusVariant(status: string): 'success' | 'secondary' | 'warning' {
		if (status === 'published') return 'success';
		if (status === 'archived') return 'warning';
		return 'secondary';
	}

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

	onMount(() => {
		fetchPosts();
	});
</script>

<div class="documents-panel">
	<div class="documents-header">
		<span class="documents-title">Documents</span>
		<div class="documents-actions">
			<button class="header-btn" onclick={() => fetchPosts()} title="Refresh" aria-label="Refresh documents">
				<span class="i-lucide-refresh-cw"></span>
			</button>
			<button class="header-btn header-btn-primary" onclick={() => { showNewForm = !showNewForm; }} title="New Post" aria-label="New post">
				<span class="i-lucide-plus"></span>
			</button>
		</div>
	</div>

	{#if showNewForm}
		<form class="new-post-form" onsubmit={(e) => { e.preventDefault(); createNewPost(); }}>
			<label class="sr-only" for="new-post-slug">Post slug</label>
			<input
				id="new-post-slug"
				type="text"
				class="slug-input"
				placeholder="post-slug"
				bind:value={slugInput}
				disabled={creating}
			/>
			<Button type="submit" variant="outline" size="sm" disabled={creating || !slugInput.trim()}>
				{#if creating}<Spinner size="xs" />{:else}Create{/if}
			</Button>
		</form>
	{/if}

	{#if error}
		<div class="documents-error">{error}</div>
	{/if}

	<div class="documents-list">
		{#if loading}
			<div class="documents-center"><Spinner size="sm" /></div>
		{:else if posts.length === 0}
			<div class="documents-center">
				<span class="i-lucide-file-text empty-icon"></span>
				<p class="empty-text">No posts yet</p>
			</div>
		{:else}
			{#each posts as p}
				<button class="document-item" onclick={() => openPost(p.id)}>
					<div class="doc-info">
						<span class="doc-title">{p.title || '(untitled)'}</span>
						<span class="doc-meta">
							<Badge variant={statusVariant(p.status)}>{p.status}</Badge>
							<span class="doc-time">{relativeTime(p.updatedAt)}</span>
						</span>
					</div>
					<span class="i-lucide-chevron-right doc-arrow"></span>
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.documents-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}

	.documents-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.documents-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.documents-actions {
		display: flex;
		gap: 2px;
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		font-size: 14px;
		border: none;
	}

	.header-btn:hover {
		background: var(--surface-2);
		color: var(--color-fg);
	}

	.header-btn-primary {
		color: var(--color-primary);
	}

	.new-post-form {
		display: flex;
		gap: 4px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.slug-input {
		flex: 1;
		padding: 4px 8px;
		font-size: 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		font-family: ui-monospace, monospace;
	}

	.slug-input::placeholder {
		color: var(--color-muted);
	}

	.documents-error {
		padding: 6px 10px;
		font-size: 12px;
		color: var(--color-error);
		background: var(--color-error-bg);
	}

	.documents-list {
		flex: 1;
		overflow-y: auto;
	}

	.documents-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		gap: 8px;
	}

	.empty-icon {
		font-size: 32px;
		color: var(--color-muted);
		opacity: 0.4;
	}

	.empty-text {
		font-size: 13px;
		color: var(--color-muted);
	}

	.document-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 8px 10px;
		gap: 8px;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--color-fg);
	}

	.document-item:hover {
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
	}

	.doc-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.doc-title {
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.doc-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.doc-time {
		color: var(--color-muted);
	}

	.doc-arrow {
		font-size: 12px;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
