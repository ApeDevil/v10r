<script lang="ts">
import { onDestroy, untrack } from 'svelte';
import { apiFetch } from '$lib/api';
import { findLeafWithPanel, getDeskBus, getDockContext, registerPanelContext, registerPanelMenus, updatePanelContext } from '$lib/components/composites/dock';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import PanelEmptyState from '$lib/components/composites/dock/PanelEmptyState.svelte';
import { Button, Spinner } from '$lib/components/primitives';
import MarkdownSource from './MarkdownSource.svelte';
import MetadataDrawer from './MetadataDrawer.svelte';
import PublishConfirmStrip from './PublishConfirmStrip.svelte';
import type { SaveState } from './types';

interface Props {
	panelId: string;
}

let { panelId }: Props = $props();

const bus = getDeskBus();
const dock = getDockContext();

// Extract documentId from panelId (e.g. "editor-pst_abc123" → "pst_abc123")
const documentId = $derived(panelId.startsWith('editor-') ? panelId.slice(7) : '');

// Re-publish content when this editor tab becomes active (so preview follows)
const isActiveTab = $derived.by(() => {
	const leaf = findLeafWithPanel(dock.root, panelId);
	return leaf ? leaf.activeTab === panelId : false;
});

$effect(() => {
	if (isActiveTab && postId) {
		publishContent();
	}
});

// Document state
let loading = $state(false);
let error = $state('');
let postId = $state('');
let slug = $state('');
let status = $state<'draft' | 'published' | 'archived'>('draft');
let title = $state('');
let summary = $state('');
let markdown = $state('');
let locale = $state('en');
let tags = $state<
	{ id: string; slug: string; name: string; icon: string | null; color: number | null; glyph: string | null }[]
>([]);
let availableTags = $state<
	{ id: string; slug: string; name: string; icon: string | null; color: number | null; glyph: string | null }[]
>([]);
let domain = $state<{ id: string; slug: string; name: string; icon: string | null; color: number | null } | null>(null);
let availableDomains = $state<{ id: string; slug: string; name: string; icon: string | null; color: number | null }[]>(
	[],
);
let revisionId = $state<string | null>(null);

// Editor state
let saveState = $state<SaveState>('saved');
let lastSavedAt = $state<Date | null>(null);
let savedMarkdown = $state('');
let showMetadata = $state(false);
let confirmingPublish = $state(false);
let confirmTimer: ReturnType<typeof setTimeout>;

// Sync tab indicator with save state
$effect(() => {
	const indicator = saveState === 'saved' ? undefined : saveState === 'saving' ? 'saving' : 'unsaved';
	dock.updatePanel(panelId, { indicator });
});

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
		domain = data.domain ?? null;
		saveState = 'saved';

		bus.publish('editor:document', { documentId: postId, type: 'blog-post' });
		publishContent();

		// Fetch available tags and domains for metadata drawer
		fetchAvailableTags();
		fetchAvailableDomains();
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
			const { data } = await res.json();
			availableTags = data.items;
		}
	} catch {
		// Non-critical
	}
}

async function fetchAvailableDomains() {
	try {
		const res = await apiFetch('/api/blog/domains');
		if (res.ok) {
			const { data } = await res.json();
			availableDomains = data.items;
		}
	} catch {
		// Non-critical
	}
}

async function handleDomainChange(domainId: string | null) {
	const prev = domain;
	domain = domainId ? (availableDomains.find((d) => d.id === domainId) ?? null) : null;
	try {
		const res = await apiFetch(`/api/blog/posts/${postId}/domain`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ domainId }),
		});
		if (!res.ok) throw new Error('Failed to save domain');
	} catch (e) {
		domain = prev;
		error = e instanceof Error ? e.message : 'Failed to save domain';
	}
}

function publishContent() {
	if (!isActiveTab) return;
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
		// save() mutates saveState via $state — re-check after await
		if ((saveState as SaveState) !== 'saved') return;
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

function startPublishConfirm() {
	confirmingPublish = true;
	clearTimeout(confirmTimer);
	confirmTimer = setTimeout(() => {
		confirmingPublish = false;
	}, 10000);
}

function handlePublishConfirm() {
	clearTimeout(confirmTimer);
	confirmingPublish = false;
	publish();
}

function cancelPublishConfirm() {
	clearTimeout(confirmTimer);
	confirmingPublish = false;
}

// Subscribe to image insertion from Explorer
const unsubInsert = bus.subscribe('files:insert-image', (payload) => {
	if (!postId) return;
	const md = `![${payload.altText}](${payload.downloadUrl})`;
	markdown = markdown ? `${markdown}\n${md}\n` : `${md}\n`;
	saveState = 'unsaved';
	clearTimeout(contentTimer);
	contentTimer = setTimeout(publishContent, 300);
});

// Subscribe to AI-triggered file refresh
const unsubAiRefresh = bus.subscribe('ai:refresh_file', ({ fileId }) => {
	if (!postId || fileId !== postId) return;
	// Reload from server — future: re-fetch markdown content
});

// Register menus for the global MenuBar
const editorMenus = $derived<MenuBarMenu[]>([
	{
		label: 'File',
		items: [
			...(saveState !== 'saved' ? [{ label: 'Save', icon: 'i-lucide-save', shortcut: 'Ctrl+S', onSelect: save }] : []),
			...(postId
				? [
						{ type: 'separator' as const },
						{
							label: 'Export as Markdown',
							icon: 'i-lucide-download',
							shortcut: 'Ctrl+Shift+X',
							onSelect: async () => {
								if (!postId) return;
								try {
									const res = await apiFetch(`/api/blog/posts/${postId}/export`);
									if (!res.ok) throw new Error('Export failed');
									const blob = await res.blob();
									const url = URL.createObjectURL(blob);
									const a = document.createElement('a');
									a.href = url;
									a.download = `${slug}.md`;
									a.click();
									URL.revokeObjectURL(url);
								} catch (e) {
									error = e instanceof Error ? e.message : 'Export failed';
								}
							},
						},
					]
				: []),
		],
	},
	...(postId
		? [
				{
					label: 'Post',
					items: [
						{
							label: 'Metadata...',
							icon: 'i-lucide-settings',
							shortcut: 'Ctrl+,',
							onSelect: () => {
								showMetadata = !showMetadata;
							},
						},
						{ type: 'separator' as const },
						...(status !== 'published'
							? [{ label: 'Publish...', icon: 'i-lucide-globe', onSelect: startPublishConfirm }]
							: [{ label: 'Update...', icon: 'i-lucide-globe', onSelect: startPublishConfirm }]),
					],
				} satisfies MenuBarMenu,
			]
		: []),
]);

// svelte-ignore state_referenced_locally
$effect(() => {
	return registerPanelMenus(panelId, { menuBar: editorMenus });
});

// ── AI Context registration ─────────────────────────────────────
let contextTimer2: ReturnType<typeof setTimeout>;

function serializeEditorContext(): string {
	if (!postId) return 'Editor: no document open';
	const parts = [`# ${title || '(untitled)'}`, `slug: ${slug}`, `status: ${status}`];
	if (summary) parts.push(`summary: ${summary}`);
	if (markdown) parts.push('', markdown);
	return parts.join('\n');
}

// Register unconditionally on mount (like SpreadsheetPanel)
// svelte-ignore state_referenced_locally
$effect(() => {
	const content = untrack(serializeEditorContext);
	const cleanup = registerPanelContext({
		panelId,
		panelType: 'editor',
		label: untrack(() => title || slug || 'Editor'),
		content,
		tokenEstimate: Math.ceil(content.length / 4),
		updatedAt: Date.now(),
		contentType: 'code',
	});
	return () => {
		clearTimeout(contextTimer2);
		cleanup();
	};
});

// Debounced context updates when content changes
$effect(() => {
	// Track reactive deps
	void markdown;
	void title;
	void summary;
	void postId;
	clearTimeout(contextTimer2);
	contextTimer2 = setTimeout(() => {
		const content = serializeEditorContext();
		updatePanelContext(panelId, {
			label: title || slug || 'Editor',
			content,
			tokenEstimate: Math.ceil(content.length / 4),
			contentType: 'code',
		});
	}, 800);
});

onDestroy(() => {
	clearTimeout(contentTimer);
	clearTimeout(contextTimer2);
	clearTimeout(tagTimer);
	clearTimeout(confirmTimer);
	unsubInsert();
	unsubAiRefresh();
});
</script>

<div class="editor-panel">
	{#if loading}
		<div class="editor-center">
			<Spinner size="md" />
			<p class="loading-text">Loading document...</p>
		</div>
	{:else if !documentId}
		<PanelEmptyState
			icon="i-lucide-pen-line"
			heading="No document open"
			description="Select a markdown file from Explorer"
		>
			<Button size="sm" variant="outline" class="gap-1.5" onclick={() => dock.ensurePanelType('explorer', 'Explorer', 'i-lucide-folder-tree')}>
				<span class="i-lucide-folder-tree"></span>
				Browse files
			</Button>
		</PanelEmptyState>
	{:else}
		{#if confirmingPublish}
			<PublishConfirmStrip
				postStatus={status}
				onconfirm={handlePublishConfirm}
				oncancel={cancelPublishConfirm}
			/>
		{/if}

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
			{domain}
			{availableDomains}
			{tags}
			{locale}
			{availableTags}
			ontitlechange={(v) => { title = v; saveState = 'unsaved'; }}
			onslugchange={(v) => { slug = v; }}
			onsummarychange={(v) => { summary = v; saveState = 'unsaved'; }}
			onlocalechange={(v) => { locale = v; }}
			ondomainchange={handleDomainChange}
			ontagstoggle={handleTagToggle}
		/>
	{/if}
</div>

<style>
	.editor-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
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
