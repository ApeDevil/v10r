<script lang="ts">
import type { Snippet } from 'svelte';
import { untrack } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { apiFetch } from '$lib/api';
import { ConfirmDialog } from '$lib/components/composites/confirm-dialog';
import * as m from '$lib/paraglide/messages';
import DeskPreferencesDialog from './DeskPreferencesDialog.svelte';
import DeskShortcuts from './DeskShortcuts.svelte';
import DockActivityBar from './DockActivityBar.svelte';
import DockMobileCommandsSheet from './DockMobileCommandsSheet.svelte';
import DockMobileControls from './DockMobileControls.svelte';
import DockMobilePanelsDrawer from './DockMobilePanelsDrawer.svelte';
import DockMobileView from './DockMobileView.svelte';
import DockNode from './DockNode.svelte';
import { setDeskBusContext } from './desk-bus.svelte';
import { getContextRegistryVersion, setContextFocus } from './desk-context.svelte';
import {
	buildThemeFromServer,
	clearDeskSettings,
	DEFAULT_THEME,
	loadDeskSettings,
	saveDeskSettings,
} from './desk-settings.persistence';
import { setDeskSettingsContext } from './desk-settings.svelte';
import type { DeskTheme } from './desk-settings.types';
import { collapseEmptyLeaves, collectPanelIds, findNode } from './dock.operations';
import { loadDockState, saveDockState } from './dock.persistence';
import { setDockContext } from './dock.state.svelte';
import type { ActivityBarItem, LayoutNode, PanelDefinition } from './dock.types';
import { setDockMobileContext } from './dock-mobile.state.svelte';
import { focusPanel } from './panel-actions';
import { setPanelMenusContext } from './panel-menus.svelte';
import { buildWorkspacesFromServer, loadWorkspaceStore, saveWorkspaceStore } from './workspace.persistence';
import { setWorkspaceContext } from './workspace.state.svelte';
import type { Workspace } from './workspace.types';

interface Props {
	initialRoot: LayoutNode;
	initialPanels: Record<string, PanelDefinition>;
	activityBarItems?: ActivityBarItem[];
	persist?: boolean | string;
	/** Ensure + focus a panel TYPE (e.g. from ?open=). */
	openPanel?: string | null;
	/** Focus an existing panel INSTANCE by id (e.g. from ?panel=). Silent no-op if unknown. */
	focusPanelId?: string | null;
	/**
	 * How the compact (<768px) chrome is placed relative to the dock box.
	 *  'floating' — open-panels tab strip on top + a floating controls pill
	 *               (commands | panels) beside the shell FAB. Chrome overlays
	 *               are position:absolute inside .dock-layout, never `fixed`.
	 *  'bar'      — contained bottom switcher strip; content never occluded.
	 *               Required for embedded consumers (a 500px demo card cannot
	 *               host floating chrome — its overlay surfaces portal to body).
	 */
	mobileChrome?: 'floating' | 'bar';
	/** Whether the user is authenticated (enables DB persistence). */
	authenticated?: boolean;
	/** Server-loaded desk theme (from DB). Null = no DB row yet. */
	serverTheme?: {
		workspace: Record<string, string | undefined>;
		typeStyles: Record<string, { bg?: string; border?: string }>;
		activePresetId: string | null;
	} | null;
	/** Server-loaded user presets (from DB). */
	serverPresets?: Array<{
		id: string;
		name: string;
		workspace: Record<string, string | undefined>;
		typeStyles: Record<string, { bg?: string; border?: string }>;
	}>;
	/** Server-loaded workspaces (from DB). */
	serverWorkspaces?: Array<{
		id: string;
		name: string;
		layout: unknown;
		sortOrder: number;
		createdAt: string;
		updatedAt: string;
	}>;
	/** Server-loaded active workspace ID. */
	serverActiveWorkspaceId?: string | null;
	/** Fires after any panel close — the host wires undo UX (e.g. toast calling `restore`). */
	onPanelClosed?: (panel: PanelDefinition, restore: () => void) => void;
	/** Sink for AI `desk:notify` effects (ai:notify bus channel). Omit = dropped. */
	onNotify?: (notification: { message: string; level: 'info' | 'success' | 'error' }) => void;
	panelContent: Snippet<[string]>;
	class?: string;
}

let {
	initialRoot,
	initialPanels,
	activityBarItems,
	persist = false,
	openPanel,
	focusPanelId = null,
	mobileChrome = 'floating',
	authenticated = false,
	serverTheme = null,
	serverPresets = [],
	serverWorkspaces = [],
	serverActiveWorkspaceId = null,
	onPanelClosed,
	onNotify,
	panelContent,
	class: className,
}: Props = $props();

// Mobile (<768px) renders a single-panel view with a bottom switcher instead
// of the split tree — contexts, persistence, and state below are shared by
// both modes (desk is ssr=false, so the SSR fallback never paints).
const isDesktop = new MediaQuery('(min-width: 768px)', true);

// svelte-ignore state_referenced_locally
const persistKey = typeof persist === 'string' ? persist : undefined;

// Try to restore persisted state, fall back to initial
// Merge initialPanels over saved panels so config changes (label, icon) always win
// svelte-ignore state_referenced_locally
const saved = persist ? loadDockState(persistKey) : null;
// svelte-ignore state_referenced_locally
const mergedPanels = saved?.panels
	? Object.fromEntries(
			Object.entries(saved.panels)
				.filter(([id]) => id in initialPanels)
				.map(([id, p]) => [id, { ...p, ...initialPanels[id] }]),
		)
	: initialPanels;

// Re-prune the saved tree against mergedPanels — the mergedPanels filter may have
// removed panels still referenced in tabs, leaving orphaned empty leaves.
function pruneAndCollapse(node: LayoutNode, panels: Record<string, PanelDefinition>): LayoutNode {
	const strip = (n: LayoutNode): LayoutNode => {
		if (n.type === 'leaf') {
			const tabs = n.tabs.filter((id) => id in panels);
			return { ...n, tabs, activeTab: tabs.includes(n.activeTab) ? n.activeTab : (tabs[0] ?? '') };
		}
		return { ...n, children: [strip(n.children[0]), strip(n.children[1])] } as LayoutNode;
	};
	return collapseEmptyLeaves(strip(node)) ?? initialRoot;
}

// svelte-ignore state_referenced_locally
const restoredRoot = saved?.root ? pruneAndCollapse(saved.root, mergedPanels) : initialRoot;
// Restore focus only if the saved leaf survived pruning — the total getter
// would fall back anyway, but a validated seed keeps the raw state honest.
// svelte-ignore state_referenced_locally
const restoredFocus =
	saved?.focusedLeafId && findNode(restoredRoot, saved.focusedLeafId)?.type === 'leaf' ? saved.focusedLeafId : null;
// svelte-ignore state_referenced_locally
const dock = setDockContext(restoredRoot, mergedPanels, saved?.activityBarPosition ?? 'left', restoredFocus, {
	// The closure runs post-init, so referencing `dock` here is safe. Restore is
	// a plain re-add (closePanel keeps the definition in the registry).
	onPanelClosed: (panel) => onPanelClosed?.(panel, () => dock.addPanel(panel)),
});

// Panel menu registry — context-scoped so two DockLayouts never share one.
const panelMenus = setPanelMenusContext();

// Mobile chrome state (surface discriminator + unsaved-close confirm) —
// context-scoped for the same reason.
const mobile = setDockMobileContext(dock);

// Overlay auto-close: every focus REQUEST (tab tap, drawer row, ?open=, AI
// effect — focusSeq counts repeats too) surfaces a panel, and closing whatever
// covers it is part of that action, not the caller's job (effect contract).
$effect(() => {
	void dock.focusSeq;
	mobile.close();
});

// Mobile projections (cheap; only rendered <768px).
const mobileOpenIds = $derived(collectPanelIds(dock.root));
const mobileVisibleId = $derived(dock.focusedPanelId);

// THE focus follower: panel menus and the AI desk context track the dock's
// focused panel from exactly one place. setContextFocus no-ops until the
// panel registers context, so the effect also re-runs on the context
// registry version to retry for just-mounted panels.
$effect(() => {
	const id = dock.focusedPanelId;
	panelMenus.setFocused(id);
	void getContextRegistryVersion();
	setContextFocus(id);
});

// DeskBus: typed pub/sub available to all panels via context
const bus = setDeskBusContext();

// Surface-independent sink for AI notifications — subscribing HERE (not in
// ChatPanel) means they survive the chat panel being closed or behind an
// overlay. Before this, ai:notify had no subscriber anywhere.
$effect(() => {
	if (!onNotify) return;
	return bus.subscribe('ai:notify', (payload) => onNotify(payload));
});

// Desk settings: panel color customization via context
// Priority: server data (DB) > localStorage cache > defaults
// svelte-ignore state_referenced_locally
const hasServerData = authenticated && serverTheme !== null;
// svelte-ignore state_referenced_locally
const initialTheme: DeskTheme = hasServerData
	? buildThemeFromServer(serverTheme, serverPresets)
	: ((browser ? loadDeskSettings() : null) ?? DEFAULT_THEME);

// DB sync callbacks (no-op when not authenticated / no server data).
// Every call goes through `apiFetch` — `/api/desk/` is not CSRF-exempt, so a
// bare `fetch` is rejected with 403 `csrf_failed` before it ever reaches a route.
async function saveThemeToApi(theme: DeskTheme) {
	try {
		await apiFetch('/api/desk/theme', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				workspace: theme.workspace,
				typeStyles: theme.typeStyles,
				activePresetId: theme.activePresetId,
			}),
		});
	} catch {
		/* silent — localStorage is the fallback */
	}
}

// svelte-ignore state_referenced_locally
const deskSettings = setDeskSettingsContext(initialTheme, {
	onCommit: (theme) => {
		// Always cache to localStorage for instant next-load
		saveDeskSettings(theme);
		// If authenticated, also persist to DB
		if (authenticated) saveThemeToApi(theme);
	},
	onCreatePreset: async (name, workspace, typeStyles) => {
		try {
			const res = await apiFetch('/api/desk/theme', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create-preset', name, workspace, typeStyles }),
			});
			const data = await res.json();
			// `apiOk` wraps every payload in `{ data }` — see api/response.ts.
			return data.data?.preset?.id ?? null;
		} catch {
			return null;
		}
	},
	onDeletePreset: async (presetId) => {
		try {
			// Item route, no body: the repo has no body-carrying DELETE anywhere.
			const res = await apiFetch(`/api/desk/theme/presets/${encodeURIComponent(presetId)}`, {
				method: 'DELETE',
			});
			return res.ok;
		} catch {
			return false;
		}
	},
});

// ── Workspace state ─────────────────────────────────────────────
// Priority: server data (DB) > localStorage cache > empty
// svelte-ignore state_referenced_locally
const hasServerWorkspaces = authenticated && serverWorkspaces.length > 0;
// svelte-ignore state_referenced_locally
const initialWorkspaces: Workspace[] = hasServerWorkspaces
	? buildWorkspacesFromServer(serverWorkspaces)
	: ((browser ? loadWorkspaceStore()?.workspaces : null) ?? []);
// svelte-ignore state_referenced_locally
const initialActiveWorkspaceId = hasServerWorkspaces
	? serverActiveWorkspaceId
	: ((browser ? loadWorkspaceStore()?.activeId : null) ?? null);

// svelte-ignore state_referenced_locally
const workspace = setWorkspaceContext(initialWorkspaces, initialActiveWorkspaceId, dock, {
	onSync: (data) => {
		if (!authenticated) return;
		try {
			apiFetch('/api/desk/workspaces/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});
		} catch {
			/* silent */
		}
	},
	onCreate: async (data) => {
		if (!authenticated) return null;
		try {
			const res = await apiFetch('/api/desk/workspaces', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});
			const result = await res.json();
			return result.data?.id ?? null;
		} catch {
			return null;
		}
	},
	onUpdate: async (id, data) => {
		if (!authenticated) return;
		try {
			await apiFetch(`/api/desk/workspaces/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});
		} catch {
			/* silent */
		}
	},
	onDelete: async (id) => {
		if (!authenticated) return;
		try {
			await apiFetch(`/api/desk/workspaces/${id}`, { method: 'DELETE' });
		} catch {
			/* silent */
		}
	},
});

// Debounced persistence — $state.snapshot() creates deep tracking
// so in-place mutations (e.g. resizeSplit) also trigger saves.
// svelte-ignore state_referenced_locally
if (persist && browser) {
	let timer: ReturnType<typeof setTimeout>;
	$effect(() => {
		// Skip saving during workspace switches
		if (workspace.isSwitching) return;
		// snapshot() deeply reads all properties, establishing fine-grained tracking
		const root = $state.snapshot(dock.root) as LayoutNode;
		const panels = $state.snapshot(dock.panels) as Record<string, PanelDefinition>;
		const barPos = dock.activityBarPosition;
		const focusedLeafId = dock.focusedLeafId ?? undefined;
		clearTimeout(timer);
		timer = setTimeout(() => {
			saveDockState(root, panels, persistKey, barPos, focusedLeafId);
			// Bump workspace modification tracking
			if (workspace.activeId) workspace.onDockChange();
		}, 300);
	});
}

// Workspace store persistence (localStorage cache)
if (browser) {
	let wsTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const ws = $state.snapshot(workspace.workspaces) as Workspace[];
		const aid = workspace.activeId;
		clearTimeout(wsTimer);
		wsTimer = setTimeout(() => saveWorkspaceStore(ws, aid), 300);
	});
}

// Save current workspace layout on tab close.
//
// `fetch(keepalive)` rather than `navigator.sendBeacon`: beacon cannot set
// headers, so it can never satisfy the `x-requested-with` CSRF check that
// guards `/api/desk/`. `keepalive` survives unload AND carries headers — the
// same transport `analytics/transport.ts` falls back to. Note both draw on the
// SAME ~64 KiB per-origin keepalive quota; a layout tree is a few KB.
//
// `pagehide` rather than `beforeunload`: merely registering `beforeunload`
// disables bfcache in Chrome/Safari and is unreliable on mobile — see
// analytics/journey-beacon.ts.
if (browser) {
	function handlePageHide() {
		if (!authenticated || !workspace.activeId) return;
		const layout = workspace.captureLayout();
		const body = JSON.stringify({ save: { id: workspace.activeId, layout }, activate: workspace.activeId });
		apiFetch('/api/desk/workspaces/sync', {
			method: 'POST',
			keepalive: true,
			headers: { 'Content-Type': 'application/json' },
			body,
		}).catch(() => {});
	}
	$effect(() => {
		window.addEventListener('pagehide', handlePageHide);
		return () => window.removeEventListener('pagehide', handlePageHide);
	});
}

// Desk settings persistence — localStorage cache (DB save happens via onCommit callback)
if (browser) {
	$effect(() => {
		const theme = $state.snapshot(deskSettings.theme) as DeskTheme;
		const timer = setTimeout(() => saveDeskSettings(theme), 300);
		return () => clearTimeout(timer);
	});
}

// One-time migration: if authenticated but server has no theme, push localStorage to DB
// svelte-ignore state_referenced_locally
if (browser && authenticated && !hasServerData) {
	const localTheme = loadDeskSettings();
	if (localTheme) {
		const builtInIds = new Set(['preset-default', 'preset-midnight', 'preset-forest']);
		const userPresets = localTheme.presets
			.filter((p) => !p.builtIn && !builtInIds.has(p.id))
			.map((p) => ({ name: p.name, workspace: p.workspace, typeStyles: p.typeStyles }));

		apiFetch('/api/desk/theme', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'migrate',
				workspace: localTheme.workspace,
				typeStyles: localTheme.typeStyles,
				activePresetId: localTheme.activePresetId,
				userPresets,
			}),
		})
			.then((res) => {
				if (res.ok)
					res.json().then((d) => {
						// `apiOk` wraps in `{ data }` — reading `d.migrated` was always
						// undefined, so the local cache was never cleared and the
						// migration re-fired on every desk load.
						if (d.data?.migrated) clearDeskSettings();
					});
			})
			.catch(() => {});
	}
}

// CSS variable injection from desk settings onto the layout container
let layoutEl = $state<HTMLElement | undefined>(undefined);
if (browser) {
	let prevKeys = new Set<string>();
	$effect(() => {
		if (!layoutEl) return;
		const vars = deskSettings.cssVarsMap;
		const currentKeys = new Set<string>();
		for (const [prop, value] of vars) {
			layoutEl.style.setProperty(prop, value);
			currentKeys.add(prop);
		}
		for (const key of prevKeys) {
			if (!currentKeys.has(key)) layoutEl.style.removeProperty(key);
		}
		prevKeys = currentKeys;
	});
}

// Open (ensure + FOCUS) a panel type via prop (e.g. from ?open=). ensurePanelType
// focuses existing instances and addPanel focuses insertions, so the panel
// surfaces on every surface — no auto-focus fallback effect needed (the dock's
// focusedLeafId getter is total). The action is untracked: the effect must
// depend on the PROP only, or closing the opened panel would resurrect it on
// the next tree change.
// svelte-ignore state_referenced_locally
$effect(() => {
	if (!openPanel) return;
	const def = Object.values(initialPanels).find((p) => p.type === openPanel);
	if (!def) return;
	untrack(() => dock.ensurePanelType(openPanel, def.label, def.icon));
});

// Focus a specific panel INSTANCE via prop (e.g. from ?panel=). Silent no-op
// when the id is not in the tree — a bad deep link must never error a workspace.
$effect(() => {
	if (!focusPanelId) return;
	const id = focusPanelId;
	untrack(() => focusPanel(dock, id));
});
</script>

<div
	bind:this={layoutEl}
	class="dock-layout {className ?? ''}"
	data-bar-position={isDesktop.current ? dock.activityBarPosition : 'mobile'}
>
	<DeskShortcuts />
	<DeskPreferencesDialog />

	{#if isDesktop.current}
		{#if activityBarItems && activityBarItems.length > 0}
			<DockActivityBar
				items={activityBarItems}
				position={dock.activityBarPosition}
			/>
		{/if}

		<div class="dock-content">
			<DockNode node={dock.root} {panelContent} />
		</div>
	{:else}
		<DockMobileView
			items={activityBarItems ?? []}
			chrome={mobileChrome}
			openPanelIds={mobileOpenIds}
			visibleId={mobileVisibleId}
			{panelContent}
		/>
		{#if mobileChrome === 'floating'}
			<DockMobileControls openCount={mobileOpenIds.length} />
			<DockMobilePanelsDrawer
				items={activityBarItems ?? []}
				openPanelIds={mobileOpenIds}
				visibleId={mobileVisibleId}
			/>
			<DockMobileCommandsSheet openPanelIds={mobileOpenIds} visibleId={mobileVisibleId} />
			<ConfirmDialog
				bind:open={() => mobile.pendingClose !== null, (value) => { if (!value) mobile.cancelPendingClose(); }}
				title={m.composites_dock_mobile_unsaved_close_title()}
				description={mobile.pendingClose
					? m.composites_dock_mobile_unsaved_close_desc({ label: mobile.pendingClose.label })
					: undefined}
				destructive
				confirmLabel={m.composites_dock_mobile_unsaved_close_confirm()}
				onconfirm={() => mobile.confirmPendingClose()}
				oncancel={() => mobile.cancelPendingClose()}
			/>
		{/if}
	{/if}
</div>

<style>
	.dock-layout {
		/* relative: mobile floating chrome anchors to the DOCK BOX (never the
		   viewport), so an embedded DockLayout stays contained in its card. */
		position: relative;
		display: grid;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background: var(--color-bg);
	}

	/* Grid layouts for each bar position */
	.dock-layout[data-bar-position='left'] {
		grid-template-areas: 'bar content';
		grid-template-columns: auto 1fr;
		grid-template-rows: 1fr;
	}

	.dock-layout[data-bar-position='right'] {
		grid-template-areas: 'content bar';
		grid-template-columns: 1fr auto;
		grid-template-rows: 1fr;
	}

	.dock-layout[data-bar-position='top'] {
		grid-template-areas: 'bar' 'content';
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
	}

	.dock-layout[data-bar-position='bottom'] {
		grid-template-areas: 'content' 'bar';
		grid-template-columns: 1fr;
		grid-template-rows: 1fr auto;
	}

	/* Mobile mode: one content area — DockMobileView lays out its own rows
	   (tabs / stack / optional bar); floating chrome overlays it. */
	.dock-layout[data-bar-position='mobile'] {
		grid-template-areas: 'content';
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
	}

	.dock-content {
		grid-area: content;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
</style>
