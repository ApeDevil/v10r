<script lang="ts">
	import { onMount } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { Button, Spinner } from '$lib/components/primitives';
	import { getDockContext, getDeskBus, registerPanelMenus } from '$lib/components/composites/dock';
	import type { PanelDefinition } from '$lib/components/composites/dock';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
	import ExplorerTree from './ExplorerTree.svelte';
	import ExplorerPreview from './ExplorerPreview.svelte';
	import type { AssetListItem, FileListItem, PostListItem, UploadingItem } from './types';

	const dock = getDockContext();
	const bus = getDeskBus();

	let loading = $state(true);
	let error = $state('');
	let posts = $state<PostListItem[]>([]);
	let assets = $state<AssetListItem[]>([]);
	let uploading = $state<UploadingItem[]>([]);
	let spreadsheetFiles = $state<FileListItem[]>([]);
	let selectedAsset = $state<AssetListItem | null>(null);
	let expandedFolders = $state(new Set(['blog', 'assets', 'images', 'data']));

	let showNewPostForm = $state(false);
	let slugInput = $state('');
	let creating = $state(false);

	// Hidden file inputs
	let uploadInput: HTMLInputElement;
	let importInput: HTMLInputElement;

	// Drag-and-drop state
	let dragOver = $state(false);

	async function fetchAll() {
		loading = true;
		error = '';
		try {
			const [postsRes, assetsRes, filesRes] = await Promise.all([
				apiFetch('/api/blog/posts'),
				apiFetch('/api/blog/assets'),
				apiFetch('/api/desk/files?type=spreadsheet'),
			]);

			if (postsRes.ok) {
				const data = await postsRes.json();
				posts = (data.items ?? []).map((p: any) => ({
					id: p.id,
					slug: p.slug,
					status: p.status,
					title: p.title ?? '(untitled)',
					updatedAt: p.updatedAt,
				}));
			}

			if (assetsRes.ok) {
				const data = await assetsRes.json();
				assets = data.items ?? [];
			}

			if (filesRes.ok) {
				const data = await filesRes.json();
				spreadsheetFiles = data.files ?? [];
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			loading = false;
		}
	}

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

	async function createSpreadsheet() {
		error = '';
		try {
			const res = await apiFetch('/api/desk/files', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'spreadsheet', name: 'Untitled' }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || 'Failed to create spreadsheet');
			}
			const { file } = await res.json();
			await fetchAll();
			openSpreadsheet({ id: file.id, type: 'spreadsheet', name: file.name, createdAt: file.createdAt, updatedAt: file.updatedAt });
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create';
		}
	}

	async function deleteSpreadsheet(f: FileListItem) {
		if (!confirm(`Delete "${f.name}"? This cannot be undone.`)) return;
		try {
			const res = await apiFetch(`/api/desk/files/${f.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || 'Delete failed');
			}
			await fetchAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Delete failed';
		}
	}

	function insertAsset(a: AssetListItem) {
		const alt = a.altText || a.fileName.replace(/\.[^.]+$/, '');
		bus.publish('files:insert-image', {
			assetId: a.id,
			fileName: a.fileName,
			altText: alt,
			imageUrl: `/api/blog/assets/${a.id}/image`,
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

	async function uploadFiles(files: FileList | File[]) {
		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				error = `"${file.name}" is not an image file.`;
				continue;
			}

			const uploadId = crypto.randomUUID();
			uploading = [...uploading, { id: uploadId, fileName: file.name, status: 'uploading' }];

			try {
				// Step 1: Get presigned URL
				const urlRes = await apiFetch('/api/blog/assets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						fileName: file.name,
						mimeType: file.type,
						fileSize: file.size,
					}),
				});
				if (!urlRes.ok) {
					const data = await urlRes.json().catch(() => ({}));
					throw new Error(data.message || 'Failed to get upload URL');
				}
				const { upload } = await urlRes.json();

				// Step 2: PUT directly to R2
				const putRes = await fetch(upload.url, {
					method: 'PUT',
					body: file,
					headers: { 'Content-Type': file.type },
				});
				if (!putRes.ok) throw new Error('Upload to storage failed');

				// Get image dimensions
				let width: number | undefined;
				let height: number | undefined;
				try {
					const bitmap = await createImageBitmap(file);
					width = bitmap.width;
					height = bitmap.height;
					bitmap.close();
				} catch {
					// Non-image or unsupported format — skip dimensions
				}

				// Step 3: Confirm upload
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

				// Remove from uploading, refresh assets
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

	async function handleImportClick() {
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

	async function deleteAsset(a: AssetListItem) {
		if (!confirm(`Delete "${a.fileName}"? This cannot be undone.`)) return;
		try {
			const res = await apiFetch(`/api/blog/assets/${a.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || 'Delete failed');
			}
			if (selectedAsset?.id === a.id) selectedAsset = null;
			await fetchAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Delete failed';
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
		if (e.dataTransfer?.files.length) {
			uploadFiles(e.dataTransfer.files);
		}
	}

	// Register menus for the global MenuBar
	const explorerMenus = $derived<MenuBarMenu[]>([
		{
			label: 'File',
			items: [
				{ label: 'New Post', icon: 'i-lucide-plus', shortcut: 'Ctrl+N', onSelect: () => { showNewPostForm = !showNewPostForm; } },
				{ label: 'New Spreadsheet', icon: 'i-lucide-sheet', onSelect: createSpreadsheet },
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

	onMount(() => {
		fetchAll();
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

	{#if loading}
		<div class="explorer-center">
			<Spinner size="sm" />
			<p class="loading-text">Loading...</p>
		</div>
	{:else}
		<ExplorerTree
			{posts}
			{assets}
			{uploading}
			{spreadsheetFiles}
			{expandedFolders}
			selectedAssetId={selectedAsset?.id ?? null}
			ontogglefolder={(f) => {
				const next = new Set(expandedFolders);
				if (next.has(f)) next.delete(f); else next.add(f);
				expandedFolders = next;
			}}
			onselectpost={openPost}
			onselectasset={selectAsset}
			onexportpost={exportPost}
			oninsertasset={insertAsset}
			oncopyasseturl={(a) => { navigator.clipboard.writeText(`/api/blog/assets/${a.id}/image`); }}
			ondeleteasset={deleteAsset}
			onselectspreadsheet={openSpreadsheet}
			ondeletespreadsheet={deleteSpreadsheet}
		/>

		<ExplorerPreview
			asset={selectedAsset}
			onclose={() => { selectedAsset = null; }}
			oninsert={insertAsset}
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
