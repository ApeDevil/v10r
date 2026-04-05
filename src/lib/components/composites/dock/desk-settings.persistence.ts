/**
 * Desk settings persistence via localStorage.
 * Follows the same pattern as dock.persistence.ts.
 */

import { browser } from '$app/environment';
import type { DeskPreset, DeskTheme } from './desk-settings.types';

const DEFAULT_KEY = 'desk-theme';
const CURRENT_VERSION = 2;

// ── Built-in presets ──────────────────────────────────────────────

export const BUILT_IN_PRESETS: DeskPreset[] = [
	{
		id: 'preset-default',
		name: 'Default',
		builtIn: true,
		workspace: {},
		typeStyles: {},
	},
];

export const DEFAULT_THEME: DeskTheme = {
	version: 2,
	workspace: {},
	typeStyles: {},
	presets: [...BUILT_IN_PRESETS],
	activePresetId: null,
};

// ── Persistence ───────────────────────────────────────────────────

export function saveDeskSettings(theme: DeskTheme, storageKey = DEFAULT_KEY): void {
	if (!browser) return;
	try {
		localStorage.setItem(storageKey, JSON.stringify(theme));
	} catch {
		// Silently fail (e.g., storage full)
	}
}

export function loadDeskSettings(storageKey = DEFAULT_KEY): DeskTheme | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return null;

		const state = JSON.parse(raw);
		if (!state || typeof state !== 'object') return null;
		if (!state.workspace || typeof state.workspace !== 'object') return null;
		if (!state.typeStyles || typeof state.typeStyles !== 'object') return null;

		// v1 → v2 migration: rename activityBarBg→shellBg, panelBorder→shellBorder
		if (state.version === 1) {
			const ws = state.workspace;
			if (ws.activityBarBg) { ws.shellBg = ws.activityBarBg; delete ws.activityBarBg; }
			if (ws.panelBorder) { ws.shellBorder = ws.panelBorder; delete ws.panelBorder; }
			state.version = 2;
			for (const preset of state.presets ?? []) {
				if (preset.builtIn) continue;
				const pws = preset.workspace;
				if (pws?.activityBarBg) { pws.shellBg = pws.activityBarBg; delete pws.activityBarBg; }
				if (pws?.panelBorder) { pws.shellBorder = pws.panelBorder; delete pws.panelBorder; }
			}
		}

		if (state.version !== CURRENT_VERSION) return null;

		// Ensure built-in presets are always present
		const builtInIds = new Set(BUILT_IN_PRESETS.map((p) => p.id));
		const userPresets = (state.presets ?? []).filter((p: DeskPreset) => !builtInIds.has(p.id));
		state.presets = [...BUILT_IN_PRESETS, ...userPresets];

		return state;
	} catch {
		return null;
	}
}

export function clearDeskSettings(storageKey = DEFAULT_KEY): void {
	if (!browser) return;
	localStorage.removeItem(storageKey);
}

/**
 * Build a DeskTheme from server-provided data (DB row + user presets).
 * Built-in presets are always prepended as code constants.
 */
export function buildThemeFromServer(
	serverTheme: {
		workspace: Record<string, string | undefined>;
		typeStyles: Record<string, { bg?: string; border?: string }>;
		activePresetId: string | null;
	} | null,
	serverPresets: Array<{
		id: string;
		name: string;
		workspace: Record<string, string | undefined>;
		typeStyles: Record<string, { bg?: string; border?: string }>;
	}>,
): DeskTheme {
	const userPresets: DeskPreset[] = serverPresets.map((p) => ({
		id: p.id,
		name: p.name,
		builtIn: false,
		workspace: p.workspace,
		typeStyles: p.typeStyles,
	}));

	if (!serverTheme) {
		return {
			...DEFAULT_THEME,
			presets: [...BUILT_IN_PRESETS, ...userPresets],
		};
	}

	return {
		version: 2,
		workspace: serverTheme.workspace,
		typeStyles: serverTheme.typeStyles,
		presets: [...BUILT_IN_PRESETS, ...userPresets],
		activePresetId: serverTheme.activePresetId,
	};
}
