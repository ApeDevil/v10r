<script lang="ts">
import { onMount, untrack } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { page } from '$app/state';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import {
	getDeskBus,
	getDockContext,
	getPanelMenus,
	registerPanelContext,
	updatePanelContext,
} from '$lib/components/desk';
import { fileIdOfPanel } from '$lib/components/desk/file-panel';
import PanelEmptyState from '$lib/components/desk/PanelEmptyState.svelte';
import { Button } from '$lib/components/primitives';
import SpreadsheetFormulaBar from './SpreadsheetFormulaBar.svelte';
import SpreadsheetGrid from './SpreadsheetGrid.svelte';
import SpreadsheetStatusBar from './SpreadsheetStatusBar.svelte';
import { createSpreadsheetState } from './spreadsheet.state.svelte';
import { getSpreadsheetSession } from './spreadsheet-session.svelte';

interface Props {
	panelId: string;
}

let { panelId }: Props = $props();

let sheet = $state(createSpreadsheetState());
const dock = getDockContext();
const panelMenus = getPanelMenus();

/** File-mode: panelId is "spreadsheet-fil_xxx" (or a suffixed second instance) → its fileId. */
const fileId = $derived(fileIdOfPanel(panelId));
let session = $state<ReturnType<typeof getSpreadsheetSession>>();
let save = $state<ReturnType<typeof getSpreadsheetSession>['autosave']['snapshot']>();
const bus = getDeskBus();

function flushEdits() {
	sheet.commitEdit();
	void session?.autosave.flush();
}

beforeNavigate(({ cancel }) => {
	flushEdits();
	// When storage is unavailable, keep the panel alive until save/export succeeds.
	if (save?.unsaved && save.backupFailed) cancel();
});

onMount(() => {
	const userId = page.data.session?.user.id;
	if (!fileId || !userId) return;
	const current = getSpreadsheetSession(userId, fileId);
	session = current;
	sheet = current.sheet;
	const unsubscribe = current.autosave.subscribe(() => {
		save = current.autosave.snapshot;
	});
	void current.autosave.refresh();
	const unsubscribeBus = bus.subscribe('ai:refresh_file', async ({ fileId: refreshId }) => {
		if (refreshId !== fileId) return;
		await current.autosave.refresh();
		// The bot's log records what the sheet now shows, not that a refresh was requested.
		const { error, conflict } = current.autosave.snapshot;
		bus.publish('ai:file_refreshed', { fileId, version: current.autosave.draft.version, ok: !error && !conflict });
	});
	const leave = (event: BeforeUnloadEvent) => {
		flushEdits();
		if (current.autosave.snapshot.unsaved) {
			event.preventDefault();
			event.returnValue = '';
		}
	};
	const hidden = () => {
		if (document.visibilityState === 'hidden') flushEdits();
	};
	window.addEventListener('beforeunload', leave);
	window.addEventListener('pagehide', flushEdits);
	window.addEventListener('online', flushEdits);
	document.addEventListener('visibilitychange', hidden);
	return () => {
		flushEdits();
		unsubscribe();
		unsubscribeBus();
		window.removeEventListener('beforeunload', leave);
		window.removeEventListener('pagehide', flushEdits);
		window.removeEventListener('online', flushEdits);
		document.removeEventListener('visibilitychange', hidden);
	};
});

function downloadDraft() {
	if (!session) return;
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(session.autosave.draft, null, 2)], { type: 'application/json' }),
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${fileId}-draft.json`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// AI Context registration. Updates are debounced for idle typing, but the registry can
// pull the current state at Send (`refresh`), so a turn sent right after an edit carries it.

let contextTimer: ReturnType<typeof setTimeout>;
// Plain variable (not $state) — only used as a guard flag within this component
let contextRegistered = false;

/** Derive the sheet name from the dock panel label (falls back to 'Sheet'). */
const sheetName = $derived(dock.panels[panelId]?.label || 'Sheet');

/** What the bot may know about this sheet right now: content plus the file it is. */
function currentContext() {
	const ctx = sheet.serializeContext(sheetName);
	return {
		label: ctx.label,
		content: ctx.content,
		tokenEstimate: ctx.tokenEstimate,
		updatedAt: Date.now(),
		...(fileId ? { fileId, fileType: 'spreadsheet' as const } : {}),
		...(session ? { version: session.autosave.draft.version, dirty: session.autosave.snapshot.unsaved } : {}),
	};
}

function pushContext() {
	clearTimeout(contextTimer);
	if (contextRegistered) updatePanelContext(panelId, currentContext());
}

// Register once on mount. untrack prevents re-running when sheet state changes.
// svelte-ignore state_referenced_locally
$effect(() => {
	const cleanup = registerPanelContext({
		panelId,
		panelType: 'spreadsheet',
		...untrack(currentContext),
		refresh: pushContext,
	});
	contextRegistered = true;
	return () => {
		clearTimeout(contextTimer);
		contextRegistered = false;
		cleanup();
	};
});

// Debounced context updates on selection/cell change
$effect(() => {
	// Read reactive deps to establish tracking
	const _active = sheet.activeCell;
	const _range = sheet.selectionRange;
	const _dirty = sheet.dirty;
	const _saved = save?.unsaved;

	if (!contextRegistered) return;

	clearTimeout(contextTimer);
	contextTimer = setTimeout(pushContext, 800);
});

const spreadsheetMenus = $derived<MenuBarMenu[]>([
	{
		label: 'Sheet',
		items: [
			{
				label: 'Clear All',
				icon: 'i-lucide-trash-2',
				onSelect: () => {
					if (save?.loaded) sheet.clear();
				},
			},
		],
	},
]);

// svelte-ignore state_referenced_locally
$effect(() => {
	return panelMenus.register(panelId, { menuBar: spreadsheetMenus });
});
</script>

<div class="sheet-panel">
	{#if !fileId}
		<PanelEmptyState
			icon="i-lucide-sheet"
			title="No spreadsheet open"
			description="Select a spreadsheet from Explorer"
		>
			<Button size="sm" variant="outline" class="gap-1.5" onclick={() => dock.ensurePanelType('explorer', 'Explorer', 'i-lucide-folder-tree')}>
				<span class="i-lucide-folder-tree"></span>
				Browse files
			</Button>
		</PanelEmptyState>
	{:else if !save?.loaded}
		<PanelEmptyState icon="i-lucide-sheet" title={save?.error ? 'Could not load spreadsheet' : 'Loading spreadsheet…'}>
			{#if save?.error}
				<Button size="sm" onclick={() => session?.autosave.refresh()}>Retry load</Button>
			{/if}
		</PanelEmptyState>
	{:else}
		<div class="save-status" role="status">
			{#if save.conflict}
				<span>Changed elsewhere. Local edits are kept; saving is paused.</span>
				<Button size="sm" variant="outline" onclick={downloadDraft}>Download local draft</Button>
				<Button size="sm" variant="outline" onclick={() => session?.autosave.discardAndReload()}>Discard local edits and reload</Button>
			{:else if save.error}
				<span>Sync failed. Your edits are still pending.</span>
				<Button size="sm" variant="outline" onclick={flushEdits}>Retry save</Button>
			{:else if save.saving}
				<span>Saving…</span>
			{:else}
				<span>{save.unsaved ? 'Unsaved changes' : 'Saved'}</span>
			{/if}
			{#if save.backupFailed}
				<span>Local backup unavailable. Keep this tab open until saved.</span>
				<Button size="sm" variant="outline" onclick={downloadDraft}>Download local draft</Button>
			{/if}
		</div>
		{#if !save.unsaved && !save.saving && save.recovery.length}
			<div class="save-status">
				<span>Recoverable drafts (may belong to another open tab):</span>
				{#each save.recovery as draft (draft.key)}
					<Button size="sm" variant="outline" onclick={() => session?.autosave.recover(draft)}>
						Recover {new Date(draft.updatedAt).toLocaleString()}
					</Button>
					<Button size="sm" variant="ghost" onclick={() => session?.autosave.dismiss(draft)}>Dismiss</Button>
				{/each}
			</div>
		{/if}
		<SpreadsheetFormulaBar {sheet} />
		<SpreadsheetGrid {sheet} />
		<SpreadsheetStatusBar stats={sheet.selectionStats} />
	{/if}
</div>

<style>
	.sheet-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
		position: relative;
	}

	.save-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
