<script lang="ts">
	import { Button } from '$lib/components/primitives';
	import type { AssetListItem } from './types';

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		const value = bytes / 1024 ** i;
		return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
	}

	interface Props {
		asset: AssetListItem | null;
		onclose: () => void;
		oninsert: (asset: AssetListItem) => void;
	}

	let { asset, onclose, oninsert }: Props = $props();

	let copied = $state(false);

	function imageUrl(a: AssetListItem) {
		return `/api/blog/assets/${a.id}/image`;
	}

	function copyMarkdown() {
		if (!asset) return;
		const alt = asset.altText || asset.fileName.replace(/\.[^.]+$/, '');
		const md = `![${alt}](${imageUrl(asset)})`;
		navigator.clipboard.writeText(md);
		copied = true;
		setTimeout(() => { copied = false; }, 1500);
	}

	function copyUrl() {
		if (!asset) return;
		navigator.clipboard.writeText(imageUrl(asset));
	}
</script>

{#if asset}
	<div class="explorer-preview">
		<div class="preview-header">
			<span class="preview-filename" title={asset.fileName}>{asset.fileName}</span>
			<button class="preview-close" onclick={onclose} aria-label="Close preview">
				<span class="i-lucide-x"></span>
			</button>
		</div>

		<div class="preview-image">
			<img src={imageUrl(asset)} alt={asset.altText || asset.fileName} />
		</div>

		<div class="preview-meta">
			{#if asset.width && asset.height}
				<span>{asset.width} × {asset.height}</span>
				<span class="meta-sep">·</span>
			{/if}
			<span>{formatBytes(asset.fileSize)}</span>
			<span class="meta-sep">·</span>
			<span>{asset.mimeType}</span>
		</div>

		<div class="preview-actions">
			<Button variant="outline" size="sm" onclick={copyMarkdown}>
				{#if copied}
					<span class="i-lucide-check h-3 w-3 mr-1"></span> Copied
				{:else}
					<span class="i-lucide-copy h-3 w-3 mr-1"></span> Copy Markdown
				{/if}
			</Button>
			<Button variant="ghost" size="sm" onclick={copyUrl}>
				<span class="i-lucide-link h-3 w-3 mr-1"></span> Copy URL
			</Button>
			<Button variant="ghost" size="sm" onclick={() => oninsert(asset)}>
				<span class="i-lucide-image-plus h-3 w-3 mr-1"></span> Insert
			</Button>
		</div>
	</div>
{/if}

<style>
	.explorer-preview {
		border-top: 1px solid var(--color-border);
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 10px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
	}

	.preview-filename {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preview-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.preview-close:hover {
		background: var(--surface-2);
		color: var(--color-fg);
	}

	.preview-image {
		max-height: 200px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		background: color-mix(in srgb, var(--color-bg) 80%, transparent);
	}

	.preview-image img {
		max-width: 100%;
		max-height: 184px;
		object-fit: contain;
		border-radius: var(--radius-sm);
	}

	.preview-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		font-size: 11px;
		color: var(--color-muted);
	}

	.meta-sep {
		opacity: 0.4;
	}

	.preview-actions {
		display: flex;
		gap: 4px;
		padding: 6px 10px;
		flex-wrap: wrap;
	}
</style>
