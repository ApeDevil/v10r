<script lang="ts">
import { onMount, untrack } from 'svelte';
import { apiFetch } from '$lib/api';
import type { PanelDefinition } from '$lib/components/composites/dock';
import {
	getDeskBus,
	getDockContext,
	registerPanelContext,
	registerPanelMenus,
	updatePanelContext,
} from '$lib/components/composites/dock';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { Button, Spinner } from '$lib/components/primitives';
import {
	adaptAssetFolders,
	adaptBlogAssets,
	adaptBlogFolders,
	adaptBlogPosts,
	adaptDeskFiles,
	adaptDeskFolders,
	assetsRootNode,
	blogRootNode,
	dataRootNode,
} from './adapters';
import type { ContextMenuCallbacks } from './context-menu-items';
import ExplorerBreadcrumb from './ExplorerBreadcrumb.svelte';
import { dispatchDeleteFolder, dispatchMove, VIRTUAL_ROOT } from './explorer-actions';
import ExplorerPreview from './ExplorerPreview.svelte';
import ExplorerTree from './ExplorerTree.svelte';
import { ExplorerState } from './explorer-state.svelte';
import MoveToDialog from './MoveToDialog.svelte';
import type { ExplorerNode } from './node';
import type { AssetListItem, FileListItem, PostListItem, UploadingItem } from './types';

const dock = getDockContext();
const bus = getDeskBus();

let loading = $state(true);
let error = $state('');
let uploading = $state<UploadingItem[]>([]);
let selectedAsset = $state<AssetListItem | null>(null);

let showNewPostForm = $state(false);
let slugInput = $state('');
let creating = $state(false);

// Hidden file inputs
let uploadInput: HTMLInputElement;
let importInput: HTMLInputElement;

// Drag-and-drop state
let dragOver = $state(false);

const explorerState = new ExplorerState();

const actionContext = {
	refresh: () => fetchAll(),
	setError: (msg: string) => {
		error = msg;
	},
	announce: (msg: string) => {
		explorerState.moveAnnouncement = msg;
	},
};

async function handleMove(nodeId: string, newParentId: string | null) {
	await dispatchMove(explorerState, nodeId, newParentId, actionContext);
}

async function fetchAll() {
	loading = true;
	error = '';
	try {
		const [postsRes, postFoldersRes, assetsRes, assetFoldersRes, filesRes, foldersRes] = await Promise.all([
			apiFetch('/api/blog/posts'),
			apiFetch('/api/blog/post-folders'),
			apiFetch('/api/blog/assets'),
			apiFetch('/api/blog/asset-folders'),
			apiFetch('/api/desk/files'),
			apiFetch('/api/desk/folders'),
		]);

		const nodes: ExplorerNode[] = [
			// Virtual roots — `virtual:images` is gone; an "Images only" filter chip
			// on the assets root replaces the separate tree.
			blogRootNode(),
			assetsRootNode(),
			dataRootNode(),
		];

		if (postsRes.ok) {
			const { data } = await postsRes.json();
			const posts: PostListItem[] = (data.items ?? []).map(
				(p: {
					id: string;
					slug: string;
					status: PostListItem['status'];
					title?: string;
					folderId: string | null;
					updatedAt: string;
				}) => ({
					id: p.id,
					slug: p.slug,
					status: p.status,
					title: p.title ?? '(untitled)',
					folderId: p.folderId ?? null,
					updatedAt: p.updatedAt,
				}),
			);
			nodes.push(...adaptBlogPosts(posts));
		}

		if (postFoldersRes.ok) {
			const { data } = await postFoldersRes.json();
			nodes.push(...adaptBlogFolders(data.folders ?? []));
		}

		if (assetsRes.ok) {
			const { data } = await assetsRes.json();
			nodes.push(...adaptBlogAssets(data.items ?? []));
		}

		if (assetFoldersRes.ok) {
			const { data } = await assetFoldersRes.json();
			nodes.push(...adaptAssetFolders(data.folders ?? []));
		}

		if (foldersRes.ok) {
			const { data } = await foldersRes.json();
			nodes.push(...adaptDeskFolders(data.folders ?? []));
		}

		if (filesRes.ok) {
			const { data } = await filesRes.json();
			nodes.push(...adaptDeskFiles(data.items ?? []));
		}

		explorerState.setNodes(nodes);
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to load';
	} finally {
		loading = false;
	}
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
	const newLabel = node.label; // node was modified with new label by TreeNode
	try {
		switch (node.source) {
			case 'desk-file':
				await apiFetch(`/api/desk/files/${node.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: newLabel }),
				});
				break;
			case 'desk-folder': {
				const res = await apiFetch(`/api/desk/folders/${node.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: newLabel }),
				});
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error?.message ?? 'Rename failed');
				}
				break;
			}
			case 'blog-folder': {
				const res = await apiFetch(`/api/blog/post-folders/${node.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: newLabel }),
				});
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error?.message ?? 'Rename failed');
				}
				break;
			}
			case 'asset-folder': {
				const res = await apiFetch(`/api/blog/asset-folders/${node.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: newLabel }),
				});
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error?.message ?? 'Rename failed');
				}
				break;
			}
			case 'blog-post': {
				const slug = newLabel.replace(/\.md$/, '');
				await apiFetch(`/api/blog/posts/${node.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ slug }),
				});
				break;
			}
			case 'blog-asset':
				await apiFetch(`/api/blog/assets/${node.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ fileName: newLabel }),
				});
				break;
		}
		await fetchAll();
	} catch (e) {
		error = e instanceof Error ? e.message : 'Rename failed';
		await fetchAll(); // Revert optimistic update
	}
}

async function handleDuplicate(node: ExplorerNode) {
	if (node.source !== 'desk-file') return;
	try {
		const res = await apiFetch(`/api/desk/files/${node.id}`, { method: 'POST' });
		if (!res.ok) throw new Error('Duplicate failed');
		const {
			data: { file: newFile },
		} = await res.json();
		await fetchAll();
		explorerState.startRename(newFile.id);
	} catch (e) {
		error = e instanceof Error ? e.message : 'Duplicate failed';
	}
}

async function handleDelete(node: ExplorerNode) {
	explorerState.cancelDelete();

	// Folders go through the centralized action primitive (recursive=true, typed errors).
	if (node.source === 'desk-folder' || node.source === 'blog-folder' || node.source === 'asset-folder') {
		await dispatchDeleteFolder(explorerState, node.id, actionContext);
		return;
	}

	try {
		switch (node.source) {
			case 'desk-file':
				await apiFetch(`/api/desk/files/${node.id}`, { method: 'DELETE' });
				break;
			case 'blog-post':
				await apiFetch(`/api/blog/posts/${node.id}`, { method: 'DELETE' });
				break;
			case 'blog-asset': {
				const res = await apiFetch(`/api/blog/assets/${node.id}`, { method: 'DELETE' });
				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					throw new Error(data.message || 'Delete failed');
				}
				if (selectedAsset?.id === node.id) selectedAsset = null;
				break;
			}
		}
		await fetchAll();
	} catch (e) {
		error = e instanceof Error ? e.message : 'Delete failed';
	}
}

async function handleToggleAiContext(node: ExplorerNode) {
	const newValue = !node.aiContext;
	explorerState.updateAiContext(node.id, newValue);

	// Desk files persist pin state server-side; blog posts are client-side only
	if (node.source === 'desk-file') {
		try {
			await apiFetch(`/api/desk/files/${node.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aiContext: newValue }),
			});
		} catch (e) {
			explorerState.updateAiContext(node.id, !newValue); // Rollback
			error = e instanceof Error ? e.message : 'Failed to toggle AI context';
		}
	}
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

const FOLDER_ENDPOINTS: Record<string, string> = {
	'virtual:data': '/api/desk/folders',
	'virtual:blog': '/api/blog/post-folders',
	'virtual:assets': '/api/blog/asset-folders',
};

function resolveVirtualRoot(node: ExplorerNode): string {
	if (node.source === 'virtual') return node.id;
	return VIRTUAL_ROOT[node.source] ?? 'virtual:data';
}

async function handleNewFolder(node: ExplorerNode) {
	const virtualRoot = resolveVirtualRoot(node);
	const endpoint = FOLDER_ENDPOINTS[virtualRoot];
	if (!endpoint) {
		error = 'Folders are not supported here.';
		return;
	}

	// Non-virtual folders hold the new child directly; leaves create a sibling.
	let parentId: string | null = null;
	if (node.source !== 'virtual') {
		parentId = node.isFolder ? node.id : (node.parentId && !node.parentId.startsWith('virtual:') ? node.parentId : null);
	}

	try {
		const res = await apiFetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ parentId }),
		});
		if (!res.ok) throw new Error('Failed to create folder');
		const {
			data: { folder },
		} = await res.json();
		await fetchAll();
		explorerState.startRename(folder.id);
		// Expand the target parent so the new folder lands visible.
		if (parentId) explorerState.expanded.add(parentId);
		else explorerState.expanded.add(virtualRoot);
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to create folder';
	}
}

async function handleNewSpreadsheet(node: ExplorerNode) {
	const folderId = node.source === 'virtual' ? null : node.id;
	try {
		const res = await apiFetch('/api/desk/files', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'spreadsheet', name: 'Untitled', folderId }),
		});
		if (!res.ok) throw new Error('Failed to create spreadsheet');
		const {
			data: { file },
		} = await res.json();
		await fetchAll();
		openSpreadsheet({
			id: file.id,
			type: 'spreadsheet',
			name: file.name,
			folderId: file.folderId ?? null,
			aiContext: false,
			createdAt: file.createdAt,
			updatedAt: file.updatedAt,
		});
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to create spreadsheet';
	}
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
	error = '';
	try {
		const res = await apiFetch('/api/blog/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slug }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.message || 'Failed to create post');
		slugInput = '';
		showNewPostForm = false;
		await fetchAll();
		openPost({ id: data.post.id, slug: data.post.slug, status: 'draft', title: '(untitled)', updatedAt: '' });
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to create';
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
		error = e instanceof Error ? e.message : 'Export failed';
	}
}

async function uploadFiles(files: FileList | File[]) {
	for (const file of files) {
		if (!file.type.startsWith('image/')) {
			error = `"${file.name}" is not an image file.`;
			continue;
		}

		const uploadId = crypto.randomUUID();
		uploading = [...uploading, { id: uploadId, fileName: file.name, status: 'uploading' }];

		try {
			const urlRes = await apiFetch('/api/blog/assets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
			});
			if (!urlRes.ok) {
				const data = await urlRes.json().catch(() => ({}));
				throw new Error(data.message || 'Failed to get upload URL');
			}
			const { upload } = await urlRes.json();

			const putRes = await fetch(upload.url, {
				method: 'PUT',
				body: file,
				headers: { 'Content-Type': file.type },
			});
			if (!putRes.ok) throw new Error('Upload to storage failed');

			let width: number | undefined;
			let height: number | undefined;
			try {
				const bitmap = await createImageBitmap(file);
				width = bitmap.width;
				height = bitmap.height;
				bitmap.close();
			} catch {
				/* Non-image or unsupported format */
			}

			const confirmRes = await apiFetch('/api/blog/assets/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					key: upload.key,
					fileName: file.name,
					mimeType: file.type,
					fileSize: file.size,
					width,
					height,
				}),
			});
			if (!confirmRes.ok) throw new Error('Failed to confirm upload');

			uploading = uploading.filter((u) => u.id !== uploadId);
			await fetchAll();
		} catch (e) {
			uploading = uploading.map((u) =>
				u.id === uploadId
					? { ...u, status: 'error' as const, error: e instanceof Error ? e.message : 'Upload failed' }
					: u,
			);
		}
	}
}

function handleUploadClick() {
	uploadInput?.click();
}
function handleUploadChange(e: Event) {
	const input = e.target as HTMLInputElement;
	if (input.files?.length) {
		uploadFiles(input.files);
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
	error = '';
	try {
		const text = await file.text();
		const res = await apiFetch('/api/blog/posts/import', {
			method: 'POST',
			headers: { 'Content-Type': 'text/markdown' },
			body: text,
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.message || 'Import failed');
		await fetchAll();
		openPost({
			id: data.post.id,
			slug: data.post.slug,
			status: data.post.status ?? 'draft',
			title: data.revision?.title ?? '(untitled)',
			updatedAt: '',
		});
	} catch (e) {
		error = e instanceof Error ? e.message : 'Import failed';
	}
}

// Drop zone handlers
function handleDragOver(e: DragEvent) {
	if (e.dataTransfer?.types.includes('Files')) {
		e.preventDefault();
		dragOver = true;
	}
}
function handleDragLeave() {
	dragOver = false;
}
function handleDrop(e: DragEvent) {
	e.preventDefault();
	dragOver = false;
	if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files);
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
			{ label: 'Refresh', icon: 'i-lucide-refresh-cw', onSelect: fetchAll },
		],
	},
]);

$effect(() => {
	return registerPanelMenus('explorer', { menuBar: explorerMenus });
});

// ── AI Context registration ─────────────────────────────────────

function serializeExplorerContext(): string {
	const allNodes = [...explorerState.nodes.values()];
	if (!allNodes.length) return 'Explorer: loading...';
	const lines = allNodes
		.filter((n) => n.source !== 'virtual')
		.map((n) => {
			const ancestors = explorerState
				.getBreadcrumbPath(n.id)
				.filter((a) => a.source !== 'virtual')
				.map((a) => a.label);
			const path = ancestors.length > 0 ? `${ancestors.join('/')}/${n.label}` : n.label;
			const prefix = n.isFolder ? 'folder' : n.source;
			return `- ${path} (${prefix}:${n.id})`;
		});
	return `Workspace files (${lines.length} items):\n${lines.join('\n')}`;
}

// Register unconditionally on mount (like SpreadsheetPanel)
// svelte-ignore state_referenced_locally
$effect(() => {
	const content = untrack(serializeExplorerContext);
	const cleanup = registerPanelContext({
		panelId: 'explorer',
		panelType: 'explorer',
		label: 'Explorer',
		content,
		tokenEstimate: Math.ceil(content.length / 4),
		updatedAt: Date.now(),
		contentType: 'structured',
	});
	return cleanup;
});

// Update context when nodes change
$effect(() => {
	void explorerState.nodes;
	if (!loading) {
		const content = serializeExplorerContext();
		updatePanelContext('explorer', {
			content,
			tokenEstimate: Math.ceil(content.length / 4),
		});
	}
});

onMount(() => {
	fetchAll();
});

// Re-fetch when AI creates/deletes files
$effect(() => {
	return bus.subscribe('ai:refresh_explorer', () => {
		fetchAll();
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
	class:drag-over={dragOver}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
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

	{#if error}
		<div class="explorer-error" role="alert">
			<span>{error}</span>
			<button class="dismiss-btn" onclick={() => { error = ''; }} aria-label="Dismiss">
				<span class="i-lucide-x"></span>
			</button>
		</div>
	{/if}

	<div class="sr-only" role="status" aria-live="polite">{explorerState.moveAnnouncement}</div>

	{#if loading}
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
		<ExplorerTree {explorerState} {uploading} callbacks={treeCallbacks} />

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

	{#if dragOver}
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
