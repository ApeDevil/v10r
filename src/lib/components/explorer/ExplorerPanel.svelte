<script lang="ts">
import { onMount, untrack } from 'svelte';
import { apiFetch } from '$lib/api';
import type { PanelDefinition } from '$lib/components/composites/dock';
import { getDeskBus, getDockContext, registerPanelMenus } from '$lib/components/composites/dock';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { Button, Spinner } from '$lib/components/primitives';
import { dataRootNode } from './adapters';
import type { ContextMenuCallbacks } from './context-menu-items';
import ExplorerBreadcrumb from './ExplorerBreadcrumb.svelte';
import ExplorerPreview from './ExplorerPreview.svelte';
import ExplorerTree from './ExplorerTree.svelte';
import {
	dispatchDeleteFolder,
	dispatchDeleteLeaf,
	dispatchDuplicate,
	dispatchMove,
	dispatchNewFolder,
	dispatchNewSpreadsheet,
	dispatchRename,
	dispatchToggleAiContext,
} from './explorer-actions';
import { registerExplorerAiContext, updateExplorerAiContext } from './explorer-ai-context';
import { ExplorerData } from './explorer-data.svelte';
import { ExplorerState } from './explorer-state.svelte';
import { ExplorerUploads } from './explorer-uploads.svelte';
import MoveToDialog from './MoveToDialog.svelte';
import type { ExplorerNode } from './node';
import type { AssetListItem, FileListItem, PostListItem } from './types';

const dock = getDockContext();
const bus = getDeskBus();

let selectedAsset = $state<AssetListItem | null>(null);

let showNewPostForm = $state(false);
let slugInput = $state('');
let creating = $state(false);

// Hidden file inputs
let uploadInput: HTMLInputElement;
let importInput: HTMLInputElement;

const explorerState = new ExplorerState();
const data = new ExplorerData();
const uploads = new ExplorerUploads();

const actionContext = {
	refresh: () => data.fetchAll(explorerState),
	setError: (msg: string) => data.setError(msg),
	announce: (msg: string) => {
		explorerState.moveAnnouncement = msg;
	},
};

async function handleMove(nodeId: string, newParentId: string | null) {
	await dispatchMove(explorerState, nodeId, newParentId, actionContext);
}

// ── Action dispatchers ────────────────────────────────────────────

function openNode(node: ExplorerNode) {
	if (node.isFolder) {
		explorerState.toggleExpanded(node.id);
		return;
	}
	explorerState.selectedId = node.id;

	switch (node.source) {
		case 'blog-post': {
			const p = node.sourceData as unknown as PostListItem;
			openPost(p);
			break;
		}
		case 'blog-asset': {
			const a = node.sourceData as unknown as AssetListItem;
			selectAsset(a);
			break;
		}
		case 'desk-file': {
			const f = node.sourceData as unknown as FileListItem;
			openSpreadsheet(f);
			break;
		}
	}
}

function openInNewPanel(node: ExplorerNode) {
	const ts = Date.now();
	switch (node.source) {
		case 'blog-post': {
			const p = node.sourceData as unknown as PostListItem;
			const panel: PanelDefinition = {
				id: `editor-${p.id}-${ts}`,
				type: 'editor',
				label: 'Editor',
				icon: 'i-lucide-pen-line',
				closable: true,
			};
			dock.addPanel(panel);
			bus.publish('editor:document', { documentId: p.id, type: 'blog-post' });
			break;
		}
		case 'desk-file': {
			const f = node.sourceData as unknown as FileListItem;
			const panel: PanelDefinition = {
				id: `spreadsheet-${f.id}-${ts}`,
				type: 'spreadsheet',
				label: f.name,
				icon: 'i-lucide-sheet',
				closable: true,
			};
			dock.addPanel(panel);
			bus.publish('spreadsheet:open', { fileId: f.id, name: f.name });
			break;
		}
	}
}

async function handleRename(node: ExplorerNode) {
	await dispatchRename(explorerState, node, actionContext);
}

async function handleDuplicate(node: ExplorerNode) {
	await dispatchDuplicate(explorerState, node, actionContext);
}

async function handleDelete(node: ExplorerNode) {
	explorerState.cancelDelete();

	if (node.source === 'desk-folder' || node.source === 'blog-folder' || node.source === 'asset-folder') {
		await dispatchDeleteFolder(explorerState, node.id, actionContext);
		return;
	}

	// Clear preview before delete so a successful blog-asset removal doesn't leave a stale selection.
	if (node.source === 'blog-asset' && selectedAsset?.id === node.id) selectedAsset = null;
	await dispatchDeleteLeaf(explorerState, node, actionContext);
}

async function handleToggleAiContext(node: ExplorerNode) {
	await dispatchToggleAiContext(explorerState, node, actionContext);
}

function handleExportMarkdown(node: ExplorerNode) {
	if (node.source !== 'blog-post') return;
	const p = node.sourceData as unknown as PostListItem;
	exportPost(p);
}

function handleInsertIntoDocument(node: ExplorerNode) {
	if (node.source !== 'blog-asset') return;
	const a = node.sourceData as unknown as AssetListItem;
	insertAsset(a);
}

function handleCopyUrl(node: ExplorerNode) {
	if (node.source !== 'blog-asset') return;
	navigator.clipboard.writeText(`/api/blog/assets/${node.id}/image`);
}

async function handleNewFolder(node: ExplorerNode) {
	await dispatchNewFolder(explorerState, node, actionContext);
}

async function handleNewSpreadsheet(node: ExplorerNode) {
	await dispatchNewSpreadsheet(explorerState, node, actionContext, openSpreadsheet);
}

let moveToDialogSource = $state<ExplorerNode | null>(null);

const menuCallbacks: ContextMenuCallbacks = {
	onOpen: openNode,
	onOpenNewPanel: openInNewPanel,
	onRename(node) {
		explorerState.startRename(node.id);
	},
	onDuplicate: handleDuplicate,
	onDelete(node) {
		explorerState.startDelete(node.id);
	},
	onToggleAiContext: handleToggleAiContext,
	onExportMarkdown: handleExportMarkdown,
	onInsertIntoDocument: handleInsertIntoDocument,
	onCopyUrl: handleCopyUrl,
	onNewFolder: handleNewFolder,
	onNewSpreadsheet: handleNewSpreadsheet,
	onMoveRequest(node) {
		moveToDialogSource = node;
	},
	onMove: handleMove,
};

// The rename callback is special: TreeNode passes the node with the new label
const treeCallbacks: ContextMenuCallbacks = {
	...menuCallbacks,
	onRename: handleRename,
	onDelete: handleDelete,
};

// ── Existing helpers (preserved) ──────────────────────────────────

function openPost(p: PostListItem) {
	const editorPanelId = `editor-${p.id}`;
	const panel: PanelDefinition = {
		id: editorPanelId,
		type: 'editor',
		label: 'Editor',
		icon: 'i-lucide-pen-line',
		closable: true,
	};
	dock.addPanel(panel);
	bus.publish('editor:document', { documentId: p.id, type: 'blog-post' });
}

function selectAsset(a: AssetListItem) {
	selectedAsset = selectedAsset?.id === a.id ? null : a;
	if (selectedAsset) {
		bus.publish('files:select', {
			type: 'asset',
			id: a.id,
			data: { fileName: a.fileName, downloadUrl: a.downloadUrl, mimeType: a.mimeType },
		});
	} else {
		bus.publish('files:select', null);
	}
}

function openSpreadsheet(f: FileListItem) {
	const panelId = `spreadsheet-${f.id}`;
	const panel: PanelDefinition = {
		id: panelId,
		type: 'spreadsheet',
		label: f.name,
		icon: 'i-lucide-sheet',
		closable: true,
	};
	dock.addPanel(panel);
	bus.publish('spreadsheet:open', { fileId: f.id, name: f.name });
}

function insertAsset(a: AssetListItem) {
	const alt = a.altText || a.fileName.replace(/\.[^.]+$/, '');
	bus.publish('files:insert-image', {
		assetId: a.id,
		fileName: a.fileName,
		altText: alt,
		downloadUrl: `/api/blog/assets/${a.id}/image`,
		_nonce: crypto.randomUUID(),
	});
}

async function createNewPost() {
	const slug = slugInput.trim();
	if (!slug) return;
	creating = true;
	data.clearError();
	try {
		const res = await apiFetch('/api/blog/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slug }),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.message || 'Failed to create post');
		slugInput = '';
		showNewPostForm = false;
		await data.fetchAll(explorerState);
		openPost({
			id: body.post.id,
			slug: body.post.slug,
			status: 'draft',
			title: '(untitled)',
			folderId: body.post.folderId ?? null,
			updatedAt: '',
		});
	} catch (e) {
		data.setError(e instanceof Error ? e.message : 'Failed to create');
	} finally {
		creating = false;
	}
}

async function exportPost(p: PostListItem) {
	try {
		const res = await apiFetch(`/api/blog/posts/${p.id}/export`);
		if (!res.ok) throw new Error('Export failed');
		const blob = await res.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${p.slug}.md`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (e) {
		data.setError(e instanceof Error ? e.message : 'Export failed');
	}
}

function handleUploadClick() {
	uploadInput?.click();
}
function handleUploadChange(e: Event) {
	const input = e.target as HTMLInputElement;
	if (input.files?.length) {
		void uploads.uploadFiles(input.files, actionContext);
		input.value = '';
	}
}
function handleImportClick() {
	importInput?.click();
}
async function handleImportChange(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	input.value = '';
	data.clearError();
	try {
		const text = await file.text();
		const res = await apiFetch('/api/blog/posts/import', {
			method: 'POST',
			headers: { 'Content-Type': 'text/markdown' },
			body: text,
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.message || 'Import failed');
		await data.fetchAll(explorerState);
		openPost({
			id: body.post.id,
			slug: body.post.slug,
			status: body.post.status ?? 'draft',
			title: body.revision?.title ?? '(untitled)',
			folderId: body.post.folderId ?? null,
			updatedAt: '',
		});
	} catch (e) {
		data.setError(e instanceof Error ? e.message : 'Import failed');
	}
}

/** Infer the target node for MenuBar folder/spreadsheet creation from current selection. */
function inferSelectedAnchor(): ExplorerNode {
	const sel = explorerState.selectedId ? explorerState.getNode(explorerState.selectedId) : null;
	return sel ?? dataRootNode();
}

// Register menus for the global MenuBar
const explorerMenus = $derived<MenuBarMenu[]>([
	{
		label: 'File',
		items: [
			{
				label: 'New Post',
				icon: 'i-lucide-plus',
				shortcut: 'Ctrl+N',
				onSelect: () => {
					showNewPostForm = !showNewPostForm;
				},
			},
			{ label: 'New Spreadsheet', icon: 'i-lucide-sheet', onSelect: () => handleNewSpreadsheet(dataRootNode()) },
			{ label: 'New Folder', icon: 'i-lucide-folder-plus', onSelect: () => handleNewFolder(inferSelectedAnchor()) },
			{ type: 'separator' },
			{ label: 'Import Markdown...', icon: 'i-lucide-file-up', onSelect: handleImportClick },
			{ label: 'Upload Image...', icon: 'i-lucide-upload', onSelect: handleUploadClick },
			{ type: 'separator' },
			{ label: 'Refresh', icon: 'i-lucide-refresh-cw', onSelect: () => data.fetchAll(explorerState) },
		],
	},
]);

$effect(() => {
	return registerPanelMenus('explorer', { menuBar: explorerMenus });
});

// ── AI Context registration ─────────────────────────────────────

// Register unconditionally on mount (like SpreadsheetPanel)
// svelte-ignore state_referenced_locally
$effect(() => untrack(() => registerExplorerAiContext(explorerState)));

// Update context when nodes change
$effect(() => {
	void explorerState.nodes;
	if (!data.loading) updateExplorerAiContext(explorerState);
});

onMount(() => {
	data.fetchAll(explorerState);
});

// Re-fetch when AI creates/deletes files
$effect(() => {
	return bus.subscribe('ai:refresh_explorer', () => {
		data.fetchAll(explorerState);
	});
});
</script>

<!-- Hidden file inputs -->
<input
	bind:this={uploadInput}
	type="file"
	accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
	multiple
	class="sr-only"
	onchange={handleUploadChange}
/>
<input
	bind:this={importInput}
	type="file"
	accept=".md,text/markdown"
	class="sr-only"
	onchange={handleImportChange}
/>

<div
	class="explorer-panel"
	class:drag-over={uploads.dragOver}
	ondragover={(e) => uploads.onDragOver(e)}
	ondragleave={() => uploads.onDragLeave()}
	ondrop={(e) => uploads.onDrop(e, actionContext)}
	role="region"
	aria-label="Explorer"
>
	{#if showNewPostForm}
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

	{#if data.error}
		<div class="explorer-error" role="alert">
			<span>{data.error}</span>
			<button class="dismiss-btn" onclick={() => data.clearError()} aria-label="Dismiss">
				<span class="i-lucide-x"></span>
			</button>
		</div>
	{/if}

	<div class="sr-only" role="status" aria-live="polite">{explorerState.moveAnnouncement}</div>

	{#if data.loading}
		<div class="explorer-center">
			<Spinner size="sm" />
			<p class="loading-text">Loading...</p>
		</div>
	{:else}
		<ExplorerBreadcrumb {explorerState} />
		<div class="assets-filter">
			<button
				type="button"
				class="filter-chip"
				class:active={explorerState.showImagesOnly}
				aria-pressed={explorerState.showImagesOnly}
				onclick={() => {
					explorerState.showImagesOnly = !explorerState.showImagesOnly;
				}}
				title="Filter assets to image files only"
			>
				<span class="i-lucide-image filter-icon" aria-hidden="true"></span>
				<span>Images only</span>
			</button>
		</div>
		<ExplorerTree {explorerState} uploading={uploads.uploading} callbacks={treeCallbacks} />

		<ExplorerPreview
			asset={selectedAsset}
			onclose={() => { selectedAsset = null; }}
			oninsert={insertAsset}
		/>

		<MoveToDialog
			{explorerState}
			source={moveToDialogSource}
			onConfirm={handleMove}
			onClose={() => { moveToDialogSource = null; }}
		/>
	{/if}

	{#if uploads.dragOver}
		<div class="drop-overlay">
			<span class="i-lucide-upload drop-icon"></span>
			<span class="drop-text">Drop images to upload</span>
		</div>
	{/if}
</div>

<style>
	.explorer-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
		position: relative;
	}

	.explorer-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.loading-text {
		font-size: 13px;
		color: var(--color-muted);
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

	.explorer-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
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

	.drop-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: color-mix(in srgb, var(--color-bg) 90%, transparent);
		border: 2px dashed var(--color-primary);
		border-radius: var(--radius-md);
		z-index: 10;
		pointer-events: none;
	}

	.drop-icon {
		font-size: 32px;
		color: var(--color-primary);
	}

	.drop-text {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-primary);
	}

	.assets-filter {
		display: flex;
		justify-content: flex-end;
		padding: 4px 10px 0;
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 22px;
		padding: 0 8px;
		font-size: 11px;
		color: var(--color-muted);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		cursor: pointer;
	}

	.filter-chip:hover {
		color: var(--color-fg);
		border-color: var(--color-primary);
	}

	.filter-chip.active {
		color: var(--color-primary);
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
	}

	.filter-icon {
		font-size: 12px;
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
