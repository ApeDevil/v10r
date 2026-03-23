<script lang="ts">
	import { Button, Spinner } from '$lib/components/primitives';
	import type { SaveState } from './types';

	interface Props {
		saveState: SaveState;
		lastSavedAt: Date | null;
		postStatus: 'draft' | 'published' | 'archived';
		hasDocument: boolean;
		onsave: () => void;
		onpublish: () => void;
		ontogglemetadata: () => void;
	}

	let {
		saveState,
		lastSavedAt,
		postStatus,
		hasDocument,
		onsave,
		onpublish,
		ontogglemetadata,
	}: Props = $props();

	let confirmingPublish = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout>;

	function relativeTime(date: Date | null): string {
		if (!date) return '';
		const diff = Date.now() - date.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		return `${hours}h ago`;
	}

	function handlePublishClick() {
		if (confirmingPublish) {
			clearTimeout(confirmTimer);
			confirmingPublish = false;
			onpublish();
		} else {
			confirmingPublish = true;
			clearTimeout(confirmTimer);
			confirmTimer = setTimeout(() => { confirmingPublish = false; }, 5000);
		}
	}

	function cancelPublish() {
		clearTimeout(confirmTimer);
		confirmingPublish = false;
	}
</script>

<div class="editor-toolbar">
	<!-- Left zone: Save -->
	<div class="toolbar-zone toolbar-left">
		<Button
			variant="ghost"
			size="sm"
			disabled={!hasDocument || saveState === 'saving'}
			onclick={onsave}
		>
			{#if saveState === 'saving'}
				<Spinner size="xs" />
			{:else}
				<span class="i-lucide-save toolbar-icon"></span>
			{/if}
			Save
		</Button>

		{#if hasDocument}
			<span class="save-indicator" class:saved={saveState === 'saved'} class:unsaved={saveState === 'unsaved'} class:saving={saveState === 'saving'} role="status" aria-live="polite">
				<span class="save-dot"></span>
				{#if saveState === 'saving'}
					Saving...
				{:else if saveState === 'unsaved'}
					Unsaved changes
				{:else if lastSavedAt}
					Saved {relativeTime(lastSavedAt)}
				{/if}
			</span>
		{/if}
	</div>

	<!-- Center zone: empty in Phase 1 -->
	<div class="toolbar-zone toolbar-center"></div>

	<!-- Right zone: Metadata + Publish -->
	<div class="toolbar-zone toolbar-right">
		<Button variant="ghost" size="sm" onclick={ontogglemetadata} disabled={!hasDocument}>
			<span class="i-lucide-settings toolbar-icon"></span>
			Metadata
		</Button>

		{#if hasDocument}
			{#if confirmingPublish}
				<Button variant="outline" size="sm" onclick={handlePublishClick}>
					Confirm publish
				</Button>
				<Button variant="ghost" size="sm" onclick={cancelPublish}>
					Cancel
				</Button>
			{:else}
				<Button
					variant="outline"
					size="sm"
					onclick={handlePublishClick}
					disabled={saveState === 'saving'}
				>
					{postStatus === 'published' ? 'Update' : 'Publish'}
				</Button>
			{/if}
		{/if}
	</div>
</div>

<style>
	.editor-toolbar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
		min-height: 36px;
	}

	.toolbar-zone {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.toolbar-left {
		flex: 1;
	}

	.toolbar-center {
		flex: 1;
		justify-content: center;
	}

	.toolbar-right {
		flex: 1;
		justify-content: flex-end;
	}

	.toolbar-icon {
		font-size: 14px;
	}

	.save-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--color-muted);
	}

	.save-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-muted);
	}

	.save-indicator.saved .save-dot {
		background: var(--color-success, #22c55e);
	}

	.save-indicator.unsaved .save-dot {
		background: var(--color-warning, #f59e0b);
	}

	.save-indicator.saving .save-dot {
		background: var(--color-muted);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		50% { opacity: 0.4; }
	}
</style>
