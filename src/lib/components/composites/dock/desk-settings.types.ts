/** Per-panel-type color overrides. Undefined = inherit from workspace/design token. */
export interface PanelColorOverride {
	bg?: string;
}

/** Workspace-level color settings applied to the entire dock. */
export interface WorkspaceColors {
	shellBg?: string;
	panelBg?: string;
	shellBorder?: string;
	tabActiveIndicator?: string;
}

/** A named, saveable theme configuration. */
export interface DeskPreset {
	id: string;
	name: string;
	builtIn: boolean;
	workspace: WorkspaceColors;
	typeStyles: Record<string, PanelColorOverride>;
}

/** Full persisted settings shape. */
export interface DeskTheme {
	version: 2;
	workspace: WorkspaceColors;
	typeStyles: Record<string, PanelColorOverride>;
	presets: DeskPreset[];
	activePresetId: string | null;
}
