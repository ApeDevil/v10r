<script lang="ts">
	import { onDestroy } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { getDeskBus, registerPanelMenus } from '$lib/components/composites/dock';
	import { Spinner } from '$lib/components/primitives';
	import Renderer from '$lib/components/blog/Renderer.svelte';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

	const bus = getDeskBus();

	let html = $state('');
	let embeds = $state<unknown>(null);
	let rendering = $state(false);
	let error = $state('');
	let hasDocument = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let abortController: AbortController | null = null;

	async function renderPreview(markdown: string) {
		rendering = true;
		error = '';

		// Abort previous request
		abortController?.abort();
		abortController = new AbortController();

		try {
			const res = await apiFetch('/api/blog/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ markdown }),
				signal: abortController.signal,
			});

			if (!res.ok) throw new Error('Preview failed');

			const data = await res.json();
			html = data.html;
			embeds = data.embeds;
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			error = e instanceof Error ? e.message : 'Preview failed';
		} finally {
			rendering = false;
		}
	}

	// Subscribe to editor content changes
	const unsubContent = bus.subscribe(
		'editor:content',
		(payload) => {
			hasDocument = true;
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				if (payload.content) renderPreview(payload.content);
			}, 300);
		},
		{ replayLast: true },
	);

	// Clear when document changes
	const unsubDocument = bus.subscribe('editor:document', (payload) => {
		if (!payload) {
			hasDocument = false;
			html = '';
			embeds = null;
		}
	});

	// Register menus for the global MenuBar
	const previewMenus: MenuBarMenu[] = [];

	$effect(() => {
		return registerPanelMenus('preview', { menuBar: previewMenus });
	});

	onDestroy(() => {
		unsubContent();
		unsubDocument();
		clearTimeout(debounceTimer);
		abortController?.abort();
	});
</script>

<div class="preview-panel">
	{#if !hasDocument}
		<div class="preview-center">
			<span class="i-lucide-eye empty-icon"></span>
			<p class="empty-text">Open a document to see preview</p>
		</div>
	{:else}
		{#if rendering && !html}
			<div class="preview-center">
				<Spinner size="sm" />
				<p class="loading-text">Rendering preview...</p>
			</div>
		{:else}
			{#if error}
				<div class="preview-error" role="alert">
					<span class="i-lucide-alert-triangle"></span>
					{error}
				</div>
			{/if}

			{#if rendering}
				<div class="preview-updating">
					<Spinner size="xs" />
					<span>Updating...</span>
				</div>
			{/if}

			<div class="preview-content" role="region" aria-label="Post preview" aria-live="polite">
				<Renderer {html} {embeds} />
			</div>
		{/if}
	{/if}
</div>

<style>
	.preview-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
		overflow: hidden;
	}

	.preview-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.empty-icon {
		font-size: 40px;
		color: var(--color-muted);
		opacity: 0.3;
	}

	.empty-text,
	.loading-text {
		font-size: 13px;
		color: var(--color-muted);
	}

	.preview-error {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 12px;
		color: var(--color-error);
		background: var(--color-error-bg);
		border-bottom: 1px solid var(--color-border);
	}

	.preview-updating {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		font-size: 11px;
		color: var(--color-muted);
		background: var(--surface-1);
		border-bottom: 1px solid var(--color-border);
	}

	.preview-content {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
	}
</style>
