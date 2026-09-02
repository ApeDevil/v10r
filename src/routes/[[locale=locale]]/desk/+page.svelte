<script lang="ts">
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { LayoutNode } from '$lib/components/desk';
import { DockLayout } from '$lib/components/desk';
import { ChatPanel } from '$lib/components/desk/panels/bot';
import { AuthorGate, EditorPanel } from '$lib/components/desk/panels/editor';
import { ExplorerPanel } from '$lib/components/desk/panels/explorer';
import IOLogPanel from '$lib/components/desk/panels/io-log/IOLogPanel.svelte';
import { PreviewPanel } from '$lib/components/desk/panels/preview';
import { SpreadsheetPanel } from '$lib/components/desk/panels/spreadsheet';
import { DESK_ACTIVITY_BAR_ITEMS, DESK_PANEL_TYPES, DESK_PANELS } from '$lib/desk/panels';
import { getToast } from '$lib/state/toast.svelte';

const toast = getToast();

// Server data from desk/+layout.server.ts
const authenticated = $derived(!!page.data.session?.user?.id);
const serverTheme = $derived(page.data.deskTheme ?? null);
const serverPresets = $derived(page.data.deskPresets ?? []);
const serverWorkspaces = $derived(page.data.deskWorkspaces ?? []);
const serverActiveWorkspaceId = $derived(page.data.deskActiveWorkspaceId ?? null);

// ?open=<type> ensures + focuses a panel type; ?panel=<id> deep-links to a
// specific instance (silent no-op on unknown ids).
let openPanel = $derived(page.url.searchParams.get('open'));
let focusPanelId = $derived(page.url.searchParams.get('panel'));

// Clean URL params after they're consumed. `replaceState`, not `goto`: a
// cosmetic URL edit must not re-run loads or fire after/beforeNavigate
// (which would e.g. auto-close the sidebar drawer). Deferred a macrotask so
// DockLayout's param effects observe the values before they vanish.
$effect(() => {
	if (!page.url.searchParams.has('open') && !page.url.searchParams.has('panel')) return;
	const timer = setTimeout(() => replaceState(page.url.pathname, page.state ?? {}), 0);
	return () => clearTimeout(timer);
});

const initialRoot: LayoutNode = {
	type: 'split',
	id: 'desk-root',
	direction: 'horizontal',
	sizes: [25, 75],
	children: [
		{
			type: 'split',
			id: 'desk-left',
			direction: 'vertical',
			sizes: [55, 45],
			children: [
				{
					type: 'leaf',
					id: 'desk-left-top',
					tabs: ['explorer'],
					activeTab: 'explorer',
				},
				{
					type: 'leaf',
					id: 'desk-left-bottom',
					tabs: ['bot'],
					activeTab: 'bot',
				},
			],
		},
		{
			type: 'split',
			id: 'desk-right',
			direction: 'vertical',
			sizes: [60, 40],
			children: [
				{
					type: 'leaf',
					id: 'desk-right-top',
					tabs: ['editor', 'preview'],
					activeTab: 'editor',
				},
				{
					type: 'leaf',
					id: 'desk-right-bottom',
					tabs: ['spreadsheet'],
					activeTab: 'spreadsheet',
				},
			],
		},
	],
};

/** Resolve panel type — handles dynamic IDs from activity bar (e.g. "editor-1709312345") */
function getPanelType(panelId: string): string | undefined {
	return DESK_PANEL_TYPES.find((t) => panelId === t || panelId.startsWith(`${t}-`));
}
</script>
<div class="desk-page">
	<DockLayout
		{initialRoot}
		initialPanels={DESK_PANELS}
		activityBarItems={DESK_ACTIVITY_BAR_ITEMS}
		persist="desk-layout"
		{openPanel}
		{focusPanelId}
		{authenticated}
		{serverTheme}
		{serverPresets}
		{serverWorkspaces}
		{serverActiveWorkspaceId}
		onPanelClosed={(panel, restore) =>
			toast?.show({
				type: 'info',
				message: `Closed ${panel.label}`,
				duration: 6000,
				action: { label: 'Undo', onclick: restore },
			})}
		onNotify={(n) => toast?.show({ type: n.level, message: n.message, duration: 6000 })}
		class="desk-dock"
	>
		{#snippet panelContent(panelId)}
			{@const type = getPanelType(panelId)}
			<div class="desk-panel">
				{#if type === 'explorer'}
					<ExplorerPanel {panelId} />
				{:else if type === 'editor'}
					<AuthorGate>
						{#snippet children()}
							<EditorPanel {panelId} />
						{/snippet}
					</AuthorGate>
				{:else if type === 'preview'}
					<PreviewPanel {panelId} />
				{:else if type === 'bot'}
					<ChatPanel {panelId} />
				{:else if type === 'spreadsheet'}
					<SpreadsheetPanel {panelId} />
				{:else if type === 'io-log'}
					<IOLogPanel {panelId} />
				{:else}
					<div class="desk-chip"><span class="i-lucide-layout-grid"></span> {panelId}</div>
				{/if}
			</div>
		{/snippet}
	</DockLayout>
</div>

<style>
	.desk-page {
		flex: 1;
		min-height: 0;
	}

	:global(.desk-dock) {
		flex: 1;
		min-height: 0;
	}

	.desk-panel {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.desk-chip {
		position: absolute;
		top: 8px;
		left: 8px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-muted);
		background: color-mix(in srgb, var(--surface-1) 60%, transparent);
		backdrop-filter: blur(4px);
		border-radius: var(--radius-md);
		pointer-events: none;
		z-index: 1;
	}

	.desk-chip span {
		font-size: 14px;
	}


</style>
