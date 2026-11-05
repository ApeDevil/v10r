<script lang="ts">
import { onMount, untrack } from 'svelte';
import { AttributeEditor, RecordSaveStatus, type RecordSession } from '#lib/components/attributes/index.ts';
import type { MenuBarMenu } from '#lib/components/composites/menu-bar/types.ts';
import { fileIdOfPanel } from '#lib/components/desk/file-panel.ts';
import {
	getDeskBus,
	getDockContext,
	getPanelMenus,
	registerPanelContext,
	updatePanelContext,
} from '#lib/components/desk/index.ts';
import PanelEmptyState from '#lib/components/desk/PanelEmptyState.svelte';
import { Button } from '#lib/components/primitives/index.ts';
import { attributeRecordToText } from '#lib/dynamic-attributes/index.ts';
import { beforeNavigate } from '$app/navigation';
import { page } from '$app/state';
import { getDeskRecordSession } from './record-session.svelte';

/**
 * A record file as a desk panel — an adapter, nothing more. The editor, its operations and its
 * save queue are the generic Dynamic Attributes pieces; this file adds what the desk owns: the
 * panel id → file id mapping, the menu bar, AI context, the bus refresh, and flushing on leave.
 */
interface Props {
	panelId: string;
}

let { panelId }: Props = $props();

const dock = getDockContext();
const panelMenus = getPanelMenus();
const bus = getDeskBus();
const fileId = $derived(fileIdOfPanel(panelId));
let session = $state<RecordSession>();
let save = $state<RecordSession['autosave']['snapshot']>();

function flush() {
	void session?.autosave.flush();
}

beforeNavigate(({ cancel, shallow }) => {
	if (shallow) return;
	flush();
	if (save?.unsaved && save.backupFailed) cancel();
});

onMount(() => {
	const userId = page.data.session?.user.id;
	if (!fileId || !userId) return;
	const current = getDeskRecordSession(userId, fileId);
	session = current;
	const unsubscribe = current.autosave.subscribe(() => {
		save = current.autosave.snapshot;
	});
	void current.autosave.refresh();
	const unsubscribeBus = bus.subscribe('ai:refresh_file', async ({ fileId: refreshId }) => {
		if (refreshId !== fileId) return;
		await current.autosave.refresh();
		const { error, conflict } = current.autosave.snapshot;
		bus.publish('ai:file_refreshed', { fileId, version: current.autosave.draft.version, ok: !error && !conflict });
	});
	const leave = (event: BeforeUnloadEvent) => {
		flush();
		if (current.autosave.snapshot.unsaved) {
			event.preventDefault();
			event.returnValue = '';
		}
	};
	const hidden = () => {
		if (document.visibilityState === 'hidden') flush();
	};
	window.addEventListener('beforeunload', leave);
	window.addEventListener('pagehide', flush);
	window.addEventListener('online', flush);
	document.addEventListener('visibilitychange', hidden);
	return () => {
		flush();
		unsubscribe();
		unsubscribeBus();
		window.removeEventListener('beforeunload', leave);
		window.removeEventListener('pagehide', flush);
		window.removeEventListener('online', flush);
		document.removeEventListener('visibilitychange', hidden);
	};
});

const recordName = $derived(dock.panels[panelId]?.label || 'Record');

function currentContext() {
	const content = session ? attributeRecordToText(session.editor.record, session.engine.kinds) : '';
	return {
		label: recordName,
		content,
		tokenEstimate: Math.ceil(content.length / 4),
		updatedAt: Date.now(),
		contentType: 'plaintext' as const,
		...(fileId ? { fileId, fileType: 'record' as const } : {}),
		...(session ? { version: session.autosave.draft.version, dirty: session.autosave.snapshot.unsaved } : {}),
	};
}

let contextTimer: ReturnType<typeof setTimeout>;
let contextRegistered = false;

function pushContext() {
	clearTimeout(contextTimer);
	if (contextRegistered) updatePanelContext(panelId, currentContext());
}

// svelte-ignore state_referenced_locally
$effect(() => {
	const cleanup = registerPanelContext({
		panelId,
		panelType: 'record',
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

$effect(() => {
	const _record = session?.editor.record;
	const _unsaved = save?.unsaved;
	if (!contextRegistered) return;
	clearTimeout(contextTimer);
	contextTimer = setTimeout(pushContext, 800);
});

function downloadJson() {
	if (!session) return;
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(session.editor.record, null, 2)], { type: 'application/json' }),
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${recordName}.record.json`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const recordMenus = $derived<MenuBarMenu[]>([
	{
		label: 'Record',
		items: [
			{
				label: 'Add Attribute',
				icon: 'i-lucide-plus',
				disabled: !save?.loaded || session?.editor.atLimit,
				onSelect: () => session?.editor.add(),
			},
			{ type: 'separator' },
			{
				label: 'Undo',
				icon: 'i-lucide-undo-2',
				disabled: !session?.editor.canUndo,
				onSelect: () => session?.editor.undo(),
			},
			{
				label: 'Redo',
				icon: 'i-lucide-redo-2',
				disabled: !session?.editor.canRedo,
				onSelect: () => session?.editor.redo(),
			},
			{ type: 'separator' },
			{ label: 'Download JSON', icon: 'i-lucide-download', disabled: !save?.loaded, onSelect: downloadJson },
		],
	},
]);

// svelte-ignore state_referenced_locally
$effect(() => {
	return panelMenus.register(panelId, { menuBar: recordMenus });
});
</script>

<div class="record-panel">
	{#if !fileId}
		<PanelEmptyState icon="i-lucide-list-tree" title="No record open" description="Open or create a record from Explorer">
			<Button
				size="sm"
				variant="outline"
				class="gap-1.5"
				onclick={() => dock.ensurePanelType('explorer', 'Explorer', 'i-lucide-folder-tree')}
			>
				<span class="i-lucide-folder-tree"></span>
				Browse files
			</Button>
		</PanelEmptyState>
	{:else if !save?.loaded || !session}
		<PanelEmptyState icon="i-lucide-list-tree" title={save?.error ? 'Could not load record' : 'Loading record…'}>
			{#if save?.error}
				<Button size="sm" onclick={() => session?.autosave.refresh()}>Retry load</Button>
			{/if}
		</PanelEmptyState>
	{:else}
		<div class="record-status">
			<RecordSaveStatus {session} snapshot={save} downloadName={fileId} />
		</div>
		<div class="record-body">
			<AttributeEditor editor={session.editor} engine={session.engine} label={recordName} />
		</div>
	{/if}
</div>

<style>
	.record-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
	}

	.record-status {
		padding: var(--spacing-1) var(--spacing-3);
	}

	.record-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--spacing-2) var(--spacing-3) var(--spacing-6);
	}
</style>
