<script lang="ts">
	import { onDestroy } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { getDeskBus } from '$lib/components/composites/dock';
	import { Spinner } from '$lib/components/primitives';
	import EditorToolbar from './EditorToolbar.svelte';
	import MarkdownSource from './MarkdownSource.svelte';
	import MetadataDrawer from './MetadataDrawer.svelte';
	import type { SaveState } from './types';

	interface Props {
		panelId: string;
	}

	let { panelId }: Props = $props();

	const bus = getDeskBus();

	// Extract documentId from panelId (e.g. "editor-pst_abc123" → "pst_abc123")
	const documentId = $derived(panelId.startsWith('editor-') ? panelId.slice(7) : '');

	// Document state
	let loading = $state(true);
	let error = $state('');
	let postId = $state('');
	let slug = $state('');
	let status = $state<'draft' | 'published' | 'archived'>('draft');
	let title = $state('');
	let summary = $state('');
	let markdown = $state('');
	let locale = $state('en');
	let tags = $state<{ id: string; slug: string; name: string }[]>([]);
	let availableTags = $state<{ id: string; slug: string; name: string }[]>([]);
	let revisionId = $state<string | null>(null);

	// Editor state
	let saveState = $state<SaveState>('saved');
	let lastSavedAt = $state<Date | null>(null);
	let savedMarkdown = $state('');
	let showMetadata = $state(false);

	// Content change debounce for DeskBus
	let contentTimer: ReturnType<typeof setTimeout>;

	// Load document when documentId changes
	$effect(() => {
		if (documentId) loadDocument(documentId);
	});

	async function loadDocument(id: string) {
		loading = true;
		error = '';
		try {
			const res = await apiFetch(`/api/blog/posts/${id}`);
			if (!res.ok) throw new Error('Failed to load post');
			const data = await res.json();

			postId = data.post.id;
			slug = data.post.slug;
			status = data.post.status;

			if (data.latestRevision) {
				title = data.latestRevision.title;
				summary = data.latestRevision.summary ?? '';
				markdown = data.latestRevision.markdown;
				locale = data.latestRevision.locale;
				revisionId = data.latestRevision.id;
				savedMarkdown = data.latestRevision.markdown;
				lastSavedAt = new Date(data.latestRevision.createdAt);
			} else {
				title = '';
				summary = '';
				markdown = '';
				savedMarkdown = '';
				revisionId = null;
				lastSavedAt = null;
			}

			tags = data.tags ?? [];
			saveState = 'saved';

			bus.publish('editor:document', { documentId: postId, type: 'blog-post' });
			publishContent();

			// Fetch available tags for metadata drawer
			fetchAvailableTags();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			loading = false;
		}
	}

	async function fetchAvailableTags() {
		try {
			const res = await apiFetch('/api/blog/tags');
			if (res.ok) {
				const data = await res.json();
				availableTags = data;
			}
		} catch {
			// Non-critical
		}
	}

	function publishContent() {
		bus.publish('editor:content', {
			content: markdown,
			type: 'blog-post',
			metadata: { title, summary, slug, postId },
		});
	}

	function handleContentChange(value: string) {
		markdown = value;
		if (value !== savedMarkdown) {
			saveState = 'unsaved';
		} else {
			saveState = 'saved';
		}

		// Debounced publish to DeskBus for preview
		clearTimeout(contentTimer);
		contentTimer = setTimeout(publishContent, 300);
	}

	async function save() {
		if (!postId || saveState === 'saving') return;
		if (!title.trim()) {
			title = 'Untitled';
		}

		saveState = 'saving';
		try {
			const res = await apiFetch(`/api/blog/posts/${postId}/revisions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, summary, markdown, locale }),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data.message || 'Failed to save');
			}

			const { revision } = data;
			revisionId = revision.id;
			savedMarkdown = markdown;
			lastSavedAt = new Date();
			saveState = 'saved';

			bus.publish('editor:save', { documentId: postId, revisionId: revision.id });
		} catch (e) {
			saveState = 'unsaved';
			error = e instanceof Error ? e.message : 'Save failed';
		}
	}

	async function publish() {
		// Save first if there are unsaved changes
		if (saveState === 'unsaved') {
			await save();
			if (saveState !== 'saved') return; // save failed
		}

		try {
			const res = await apiFetch(`/api/blog/posts/${postId}/publish`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ locale }),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data.message || 'Failed to publish');
			}

			status = 'published';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Publish failed';
		}
	}

	function handleTagToggle(tagId: string) {
		const existing = tags.find((t) => t.id === tagId);
		if (existing) {
			tags = tags.filter((t) => t.id !== tagId);
		} else {
			const tag = availableTags.find((t) => t.id === tagId);
			if (tag) tags = [...tags, tag];
		}
		// Save tags via API
		saveTagsDebounced();
	}

	let tagTimer: ReturnType<typeof setTimeout>;
	function saveTagsDebounced() {
		const previousTags = [...tags];
		clearTimeout(tagTimer);
		tagTimer = setTimeout(async () => {
			try {
				const res = await apiFetch(`/api/blog/posts/${postId}/tags`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tagIds: tags.map((t) => t.id) }),
				});
				if (!res.ok) throw new Error('Failed to save tags');
			} catch (e) {
				tags = previousTags;
				error = e instanceof Error ? e.message : 'Failed to save tags';
			}
		}, 500);
	}

	onDestroy(() => {
		clearTimeout(contentTimer);
		clearTimeout(tagTimer);
	});
</script>

<div class="editor-panel">
	{#if loading}
		<div class="editor-center">
			<Spinner size="md" />
			<p class="loading-text">Loading document...</p>
		</div>
	{:else if !documentId}
		<div class="editor-center">
			<span class="i-lucide-pen-line empty-icon"></span>
			<p class="empty-text">Open a document from the Documents panel</p>
		</div>
	{:else}
		<EditorToolbar
			{saveState}
			{lastSavedAt}
			postStatus={status}
			hasDocument={!!postId}
			onsave={save}
			onpublish={publish}
			ontogglemetadata={() => { showMetadata = !showMetadata; }}
		/>

		{#if error}
			<div class="editor-error" role="alert">
				<span>{error}</span>
				<button class="dismiss-btn" aria-label="Dismiss error" onclick={() => { error = ''; }}>
					<span class="i-lucide-x"></span>
				</button>
			</div>
		{/if}

		<MarkdownSource
			bind:value={markdown}
			onsave={save}
			oninput={handleContentChange}
		/>

		<MetadataDrawer
			bind:open={showMetadata}
			{title}
			{slug}
			{summary}
			{status}
			{tags}
			{locale}
			{availableTags}
			ontitlechange={(v) => { title = v; saveState = 'unsaved'; }}
			onslugchange={(v) => { slug = v; }}
			onsummarychange={(v) => { summary = v; saveState = 'unsaved'; }}
			onlocalechange={(v) => { locale = v; }}
			ontagstoggle={handleTagToggle}
		/>
	{/if}
</div>

<style>
	.editor-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}

	.editor-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.loading-text {
		font-size: 13px;
		color: var(--color-muted);
	}

	.empty-icon {
		font-size: 40px;
		color: var(--color-muted);
		opacity: 0.3;
	}

	.empty-text {
		font-size: 13px;
		color: var(--color-muted);
	}

	.editor-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		font-size: 12px;
		color: var(--color-error);
		background: var(--color-error-bg);
		border-bottom: 1px solid var(--color-border);
	}

	.dismiss-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		color: var(--color-error);
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.dismiss-btn:hover {
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
	}
</style>
