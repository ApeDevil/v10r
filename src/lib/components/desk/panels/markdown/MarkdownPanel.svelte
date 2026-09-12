<script lang="ts">
/**
 * MarkdownPanel — the read-only viewer for a desk markdown file.
 *
 * Until it existed, a desk document had no panel: the Explorer opened every desk file as
 * a spreadsheet, and a bot-created or bot-edited document was a row nobody could open.
 * This panel makes a markdown mutation VISIBLE — it loads the file, shows its version,
 * reloads when the bot's `ai:refresh_file` names it, and answers `ai:file_refreshed` so
 * the bot's log records what the panel now shows rather than that a refresh was asked
 * for. It also registers the document as AI context, so the bot can read what is open.
 *
 * Read-only by design (the decision of 2026-09-12): editing desk markdown is the bot's
 * job through approved proposals; a text editor here is a later, separate decision.
 */
import { onMount } from 'svelte';
import { apiFetch } from '$lib/api';
import { MarkdownProse } from '$lib/components/composites/markdown';
import { getDeskBus, getDockContext, registerPanelContext } from '$lib/components/desk';
import { estimateTokens } from '$lib/components/desk/desk-context.pure';
import { fileIdOfPanel } from '$lib/components/desk/file-panel';
import PanelEmptyState from '$lib/components/desk/PanelEmptyState.svelte';
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { renderMarkdown } from '$lib/utils/markdown';

interface Props {
	panelId: string;
}

let { panelId }: Props = $props();

interface LoadedDocument {
	name: string;
	content: string;
	version: number;
}

const bus = getDeskBus();
const dock = getDockContext();
const fileId = $derived(fileIdOfPanel(panelId));

let doc = $state<LoadedDocument | null>(null);
let failed = $state(false);
let loading = $state(false);

const html = $derived(doc ? renderMarkdown(doc.content) : '');

async function load(): Promise<boolean> {
	if (!fileId) return false;
	loading = true;
	try {
		const res = await apiFetch(`/api/desk/files/${fileId}`, { signal: AbortSignal.timeout(15_000) });
		if (!res.ok) throw new Error(`load failed: ${res.status}`);
		const { data } = await res.json();
		if (typeof data?.markdown?.content !== 'string' || !Number.isInteger(data.markdown.version)) {
			throw new Error('not a markdown file');
		}
		doc = { name: data.file.name, content: data.markdown.content, version: data.markdown.version };
		failed = false;
		if (dock.panels[panelId] && dock.panels[panelId].label !== doc.name) dock.updatePanel(panelId, { label: doc.name });
		return true;
	} catch {
		failed = true;
		return false;
	} finally {
		loading = false;
	}
}

onMount(() => {
	void load();
	const unsubscribe = bus.subscribe('ai:refresh_file', async ({ fileId: refreshId }) => {
		if (!fileId || refreshId !== fileId) return;
		const ok = await load();
		bus.publish('ai:file_refreshed', { fileId, version: doc?.version ?? null, ok });
	});
	return unsubscribe;
});

// The open document is AI context: what the bot can read without a tool call. Every
// (re)load registers the current version; the cleanup of the previous run unregisters it.
$effect(() => {
	if (!doc) return;
	return registerPanelContext({
		panelId,
		panelType: 'markdown',
		label: doc.name,
		content: `# Document: ${doc.name} (version ${doc.version})\n\n${doc.content}`,
		tokenEstimate: estimateTokens(doc.content),
		updatedAt: Date.now(),
		contentType: 'plaintext',
		...(fileId ? { fileId, fileType: 'markdown' as const } : {}),
		version: doc.version,
		dirty: false,
	});
});
</script>

<div class="markdown-panel">
	{#if !fileId}
		<PanelEmptyState
			icon="i-lucide-file-text"
			title={m.composites_desk_markdown_none_open()}
			description={m.composites_desk_markdown_none_open_hint()}
		>
			<Button
				size="sm"
				variant="outline"
				class="gap-1.5"
				onclick={() => dock.ensurePanelType('explorer', 'Explorer', 'i-lucide-folder-tree')}
			>
				<span class="i-lucide-folder-tree"></span>
				{m.composites_desk_markdown_browse_files()}
			</Button>
		</PanelEmptyState>
	{:else if !doc}
		<PanelEmptyState icon="i-lucide-file-text" title={failed ? m.composites_desk_markdown_load_failed() : m.composites_desk_markdown_loading()}>
			{#if failed}
				<Button size="sm" disabled={loading} onclick={() => load()}>{m.composites_desk_markdown_retry()}</Button>
			{/if}
		</PanelEmptyState>
	{:else}
		<div class="markdown-status" role="status">
			<span>{m.composites_desk_markdown_version({ version: doc.version })}</span>
			<span class="markdown-readonly">{m.composites_desk_markdown_read_only()}</span>
		</div>
		<div class="markdown-body">
			<MarkdownProse {html} />
		</div>
	{/if}
</div>

<style>
	.markdown-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
	}

	.markdown-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 12px;
		font-size: 12px;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
	}

	.markdown-readonly {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.markdown-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px 32px;
	}
</style>
