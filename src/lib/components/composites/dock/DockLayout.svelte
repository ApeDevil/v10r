<script lang="ts">
import type { Snippet } from 'svelte';
import { browser } from '$app/environment';
import DeskShortcuts from './DeskShortcuts.svelte';
import DockActivityBar from './DockActivityBar.svelte';
import DockNode from './DockNode.svelte';
import { collectLeaves, hasPanelType } from './dock.operations';
import { loadDockState, saveDockState } from './dock.persistence';
import { buildThemeFromServer, loadDeskSettings, saveDeskSettings, clearDeskSettings, DEFAULT_THEME } from './desk-settings.persistence';
import { setDeskSettingsContext } from './desk-settings.svelte';
import type { DeskTheme } from './desk-settings.types';
import { setDeskBusContext } from './desk-bus.svelte';
import { setDockContext } from './dock.state.svelte';
import DeskPreferencesDialog from './DeskPreferencesDialog.svelte';
import type { ActivityBarItem, LayoutNode, PanelDefinition } from './dock.types';

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
	panelContent,
	class: className,
}: Props = $props();

const persistKey = typeof persist === 'string' ? persist : undefined;

// Try to restore persisted state, fall back to initial
const saved = persist ? loadDockState(persistKey) : null;
const dock = setDockContext(
	saved?.root ?? initialRoot,
	saved?.panels ?? initialPanels,
	saved?.activityBarPosition ?? 'left',
);

// DeskBus: typed pub/sub available to all panels via context
setDeskBusContext();

// Desk settings: panel color customization via context
// Priority: server data (DB) > localStorage cache > defaults
const hasServerData = authenticated && serverTheme !== null;
const initialTheme: DeskTheme = hasServerData
	? buildThemeFromServer(serverTheme, serverPresets)
	: (browser ? loadDeskSettings() : null) ?? DEFAULT_THEME;

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
	} catch { /* silent — localStorage is the fallback */ }
}

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
		} catch { return null; }
	},
	onDeletePreset: async (presetId) => {
		try {
			const res = await fetch('/api/desk/theme', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: presetId }),
			});
			return res.ok;
		} catch { return false; }
	},
});

// Debounced persistence — $state.snapshot() creates deep tracking
// so in-place mutations (e.g. resizeSplit) also trigger saves.
if (persist && browser) {
	let timer: ReturnType<typeof setTimeout>;
	$effect(() => {
		// snapshot() deeply reads all properties, establishing fine-grained tracking
		const root = $state.snapshot(dock.root) as LayoutNode;
		const panels = $state.snapshot(dock.panels) as Record<string, PanelDefinition>;
		const barPos = dock.activityBarPosition;
		clearTimeout(timer);
		timer = setTimeout(() => saveDockState(root, panels, persistKey, barPos), 300);
	});
}

// Desk settings persistence — localStorage cache (DB save happens via onCommit callback)
if (browser) {
	let themeTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const theme = $state.snapshot(deskSettings.theme) as DeskTheme;
		clearTimeout(themeTimer);
		themeTimer = setTimeout(() => saveDeskSettings(theme), 300);
	});
}

// One-time migration: if authenticated but server has no theme, push localStorage to DB
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
		}).then((res) => {
			if (res.ok) res.json().then((d) => { if (d.migrated) clearDeskSettings(); });
		}).catch(() => {});
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
