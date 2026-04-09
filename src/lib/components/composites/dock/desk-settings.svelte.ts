/**
 * Desk settings state management (SSR-safe using context pattern).
 * Follows dock.state.svelte.ts pattern: factory + Symbol + get/set context.
 */

import { getContext, setContext } from 'svelte';
import type { DeskTheme, PanelColorOverride, WorkspaceColors } from './desk-settings.types';

const DESK_SETTINGS_CTX = Symbol('desk-settings');

export interface DeskSettingsOptions {
	/** Called after commitDraft to persist to DB. */
	onCommit?: (theme: DeskTheme) => void;
	/** Called when a preset is created. Returns the server-assigned ID. */
	onCreatePreset?: (
		name: string,
		workspace: WorkspaceColors,
		typeStyles: Record<string, PanelColorOverride>,
	) => Promise<string | null>;
	/** Called when a preset is deleted. */
	onDeletePreset?: (presetId: string) => Promise<boolean>;
}

export function createDeskSettings(initial: DeskTheme, options: DeskSettingsOptions = {}) {
	let committed = $state<DeskTheme>(structuredClone(initial));
	let draft = $state<DeskTheme | null>(null);
	let dialogOpen = $state(false);
	let dialogTab = $state<'workspace' | 'panels' | 'presets'>('workspace');

	// ── Dialog lifecycle ──────────────────────────────────────────

	function openDialog(tab?: 'workspace' | 'panels' | 'presets') {
		draft = $state.snapshot(committed) as DeskTheme;
		if (tab) dialogTab = tab;
		dialogOpen = true;
	}

	function commitDraft() {
		if (!draft) return;
		committed = $state.snapshot(draft) as DeskTheme;
		draft = null;
		dialogOpen = false;
		options.onCommit?.(committed);
	}

	function discardDraft() {
		draft = null;
		dialogOpen = false;
	}

	// ── Workspace colors ──────────────────────────────────────────

	function setWorkspaceColor(key: keyof WorkspaceColors, value: string) {
		if (!draft) return;
		draft.workspace = { ...draft.workspace, [key]: value };
	}

	function clearWorkspaceColor(key: keyof WorkspaceColors) {
		if (!draft) return;
		const { [key]: _, ...rest } = draft.workspace;
		draft.workspace = rest;
	}

	// ── Panel type styles ─────────────────────────────────────────

	function setTypeStyle(panelType: string, key: keyof PanelColorOverride, value: string) {
		if (!draft) return;
		draft.typeStyles = {
			...draft.typeStyles,
			[panelType]: { ...draft.typeStyles[panelType], [key]: value },
		};
	}

	function clearTypeStyle(panelType: string) {
		if (!draft) return;
		const { [panelType]: _, ...rest } = draft.typeStyles;
		draft.typeStyles = rest;
	}

	// ── Presets ────────────────────────────────────────────────────

	function applyPreset(presetId: string) {
		if (!draft) return;
		const preset = draft.presets.find((p) => p.id === presetId);
		if (!preset) return;
		draft.workspace = $state.snapshot(preset.workspace);
		draft.typeStyles = $state.snapshot(preset.typeStyles);
		draft.activePresetId = presetId;
	}

	async function saveAsPreset(name: string) {
		if (!draft) return;
		const ws = $state.snapshot(draft.workspace) as WorkspaceColors;
		const ts = $state.snapshot(draft.typeStyles) as Record<string, PanelColorOverride>;

		// Try to persist to DB first for real ID
		const serverId = await options.onCreatePreset?.(name, ws, ts);
		const id = serverId ?? `preset-${Date.now()}`;

		draft.presets = [...draft.presets, { id, name, builtIn: false, workspace: ws, typeStyles: ts }];
		draft.activePresetId = id;
	}

	async function deletePreset(presetId: string) {
		if (!draft) return;
		// Try to delete from DB
		await options.onDeletePreset?.(presetId);
		draft.presets = draft.presets.filter((p) => p.id !== presetId || p.builtIn);
		if (draft.activePresetId === presetId) draft.activePresetId = null;
	}

	function resetToDefaults() {
		if (!draft) return;
		draft.workspace = {};
		draft.typeStyles = {};
		draft.activePresetId = null;
	}

	// ── Derived: active source (draft for live preview, committed otherwise) ──

	const activeDraft = $derived<DeskTheme>(draft ?? committed);

	// ── Derived: CSS variable map ─────────────────────────────────

	const cssVarsMap = $derived.by(() => {
		const vars = new Map<string, string>();
		const ws = activeDraft.workspace;
		if (ws.shellBg) vars.set('--desk-shell-bg', ws.shellBg);
		if (ws.panelBg) vars.set('--desk-panel-bg', ws.panelBg);
		if (ws.shellBorder) vars.set('--desk-shell-border', ws.shellBorder);
		if (ws.tabActiveIndicator) vars.set('--desk-tab-active-indicator', ws.tabActiveIndicator);
		return vars;
	});

	// ── Resolution: merge type override for a given panel type ────

	function resolvePanel(panelType: string): PanelColorOverride {
		const typeOverride = activeDraft.typeStyles[panelType];
		if (!typeOverride) return {};
		return { ...typeOverride };
	}

	return {
		get theme() {
			return committed;
		},
		get draft() {
			return draft;
		},
		get dialogOpen() {
			return dialogOpen;
		},
		set dialogOpen(v: boolean) {
			if (!v && draft) discardDraft();
			else dialogOpen = v;
		},
		get dialogTab() {
			return dialogTab;
		},
		set dialogTab(v: 'workspace' | 'panels' | 'presets') {
			dialogTab = v;
		},
		get cssVarsMap() {
			return cssVarsMap;
		},

		openDialog,
		commitDraft,
		discardDraft,
		setWorkspaceColor,
		clearWorkspaceColor,
		setTypeStyle,
		clearTypeStyle,
		applyPreset,
		saveAsPreset,
		deletePreset,
		resetToDefaults,
		resolvePanel,
	};
}

export type DeskSettings = ReturnType<typeof createDeskSettings>;

export function setDeskSettingsContext(initial: DeskTheme, options?: DeskSettingsOptions): DeskSettings {
	const state = createDeskSettings(initial, options);
	setContext(DESK_SETTINGS_CTX, state);
	return state;
}

export function getDeskSettings(): DeskSettings {
	return getContext<DeskSettings>(DESK_SETTINGS_CTX);
}
