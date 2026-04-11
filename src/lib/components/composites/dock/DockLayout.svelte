<script lang="ts">
import type { Snippet } from 'svelte';
import { browser } from '$app/environment';
import DeskPreferencesDialog from './DeskPreferencesDialog.svelte';
import DeskShortcuts from './DeskShortcuts.svelte';
import DockActivityBar from './DockActivityBar.svelte';
import DockNode from './DockNode.svelte';
import { setDeskBusContext } from './desk-bus.svelte';
import {
	buildThemeFromServer,
	clearDeskSettings,
	DEFAULT_THEME,
	loadDeskSettings,
	saveDeskSettings,
} from './desk-settings.persistence';
import { setDeskSettingsContext } from './desk-settings.svelte';
import type { DeskTheme } from './desk-settings.types';
import { collapseEmptyLeaves, collectLeaves, hasPanelType } from './dock.operations';
import { loadDockState, saveDockState } from './dock.persistence';
import { setDockContext } from './dock.state.svelte';
import type { ActivityBarItem, LayoutNode, PanelDefinition } from './dock.types';
import { buildWorkspacesFromServer, loadWorkspaceStore, saveWorkspaceStore } from './workspace.persistence';
import { setWorkspaceContext } from './workspace.state.svelte';
import type { Workspace } from './workspace.types';

interface Props {
	initialRoot: LayoutNode;
	initialPanels: Record<string, PanelDefinition>;
	activityBarItems?: ActivityBarItem[];
	persist?: boolean | string;
	openPanel?: string | null;
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
	panelContent: Snippet<[string]>;
	class?: string;
}

let {
	initialRoot,
	initialPanels,
	activityBarItems,
	persist = false,
	openPanel,
	authenticated = false,
	serverTheme = null,
	serverPresets = [],
	serverWorkspaces = [],
	serverActiveWorkspaceId = null,
	panelContent,
	class: className,
}: Props = $props();

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
// svelte-ignore state_referenced_locally
const dock = setDockContext(restoredRoot, mergedPanels, saved?.activityBarPosition ?? 'left');

// DeskBus: typed pub/sub available to all panels via context
setDeskBusContext();

// Desk settings: panel color customization via context
// Priority: server data (DB) > localStorage cache > defaults
// svelte-ignore state_referenced_locally
const hasServerData = authenticated && serverTheme !== null;
// svelte-ignore state_referenced_locally
const initialTheme: DeskTheme = hasServerData
	? buildThemeFromServer(serverTheme, serverPresets)
	: ((browser ? loadDeskSettings() : null) ?? DEFAULT_THEME);

// DB sync callbacks (no-op when not authenticated / no server data)
async function saveThemeToApi(theme: DeskTheme) {
	try {
		await fetch('/api/desk/theme', {
			method: 'PUT',
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
			const res = await fetch('/api/desk/theme', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create-preset', name, workspace, typeStyles }),
			});
			const data = await res.json();
			return data.preset?.id ?? null;
		} catch {
			return null;
		}
	},
	onDeletePreset: async (presetId) => {
		try {
			const res = await fetch('/api/desk/theme', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: presetId }),
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
			fetch('/api/desk/workspaces/sync', {
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
			const res = await fetch('/api/desk/workspaces', {
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
			await fetch(`/api/desk/workspaces/${id}`, {
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
			await fetch(`/api/desk/workspaces/${id}`, { method: 'DELETE' });
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
		clearTimeout(timer);
		timer = setTimeout(() => {
			saveDockState(root, panels, persistKey, barPos);
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

// Save current workspace layout on tab close via sendBeacon
if (browser) {
	function handleBeforeUnload() {
		if (!authenticated || !workspace.activeId) return;
		const layout = workspace.captureLayout();
		const body = JSON.stringify({ save: { id: workspace.activeId, layout }, activate: workspace.activeId });
		navigator.sendBeacon('/api/desk/workspaces/sync', new Blob([body], { type: 'application/json' }));
	}
	$effect(() => {
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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

		fetch('/api/desk/theme', {
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
						if (d.migrated) clearDeskSettings();
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

// Auto-focus the first leaf so the kebab menu is visible on load
if (browser) {
	$effect(() => {
		if (dock.focusedLeafId) return;
		const leaves = collectLeaves(dock.root);
		if (leaves.length > 0) dock.setFocusedLeaf(leaves[0].id);
	});
}

// Open a panel type via prop (e.g. from URL search param)
// svelte-ignore state_referenced_locally
$effect(() => {
	if (!openPanel) return;
	if (hasPanelType(dock.root, openPanel, dock.panels)) return;
	const def = Object.values(initialPanels).find((p) => p.type === openPanel);
	if (!def) return;
	dock.addPanel({
		id: `${openPanel}-${Date.now()}`,
		type: def.type,
		label: def.label,
		icon: def.icon,
		closable: true,
	});
});
</script>

<div
	bind:this={layoutEl}
	class="dock-layout {className ?? ''}"
	data-bar-position={dock.activityBarPosition}
>
	<DeskShortcuts />
	<DeskPreferencesDialog />

	{#if activityBarItems && activityBarItems.length > 0}
		<DockActivityBar
			items={activityBarItems}
			position={dock.activityBarPosition}
		/>
	{/if}

	<div class="dock-content">
		<DockNode node={dock.root} {panelContent} />
	</div>
</div>

<style>
	.dock-layout {
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

	.dock-content {
		grid-area: content;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
</style>
