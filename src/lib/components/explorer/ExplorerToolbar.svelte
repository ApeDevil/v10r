<script lang="ts">
	interface Props {
		onrefresh: () => void;
		onnewpost: () => void;
		onupload: () => void;
		onimport: () => void;
	}

	let { onrefresh, onnewpost, onupload, onimport }: Props = $props();
</script>

<div class="explorer-toolbar">
	<span class="explorer-title">
		<span class="i-lucide-folder-tree"></span>
		Explorer
	</span>
	<div class="explorer-actions">
		<button class="action-btn" onclick={onrefresh} title="Refresh" aria-label="Refresh">
			<span class="i-lucide-refresh-cw"></span>
		</button>
		<button class="action-btn" onclick={onimport} title="Import .md file" aria-label="Import markdown file">
			<span class="i-lucide-file-up"></span>
		</button>
		<button class="action-btn" onclick={onupload} title="Upload image" aria-label="Upload image">
			<span class="i-lucide-upload"></span>
		</button>
		<button class="action-btn action-btn-primary" onclick={onnewpost} title="New post" aria-label="New post">
			<span class="i-lucide-plus"></span>
		</button>
	</div>
</div>

<style>
	.explorer-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.explorer-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.explorer-actions {
		display: flex;
		gap: 2px;
	}

	.action-btn {
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

	.action-btn:hover {
		background: var(--surface-2);
		color: var(--color-fg);
	}

	.action-btn-primary {
		color: var(--color-primary);
	}
</style>
