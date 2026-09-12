/**
 * How a desk file and the panel showing it name each other.
 *
 * The canonical instance id of a file panel is `<panelType>-<fileId>`; the Explorer's
 * "open in new panel" appends a timestamp for a second instance. Every reader of a panel
 * id goes through `fileIdOfPanel`, so the suffix is understood in exactly one place — an
 * `editor-` panel once sliced its id by hand and read `pst_x-1725` as a document id.
 * AI effects that target a file find its OPEN instance through `findFilePanel` instead of
 * assuming the canonical id, so a file already open never opens a second time.
 */
import type { LayoutNode, PanelDefinition } from '$lib/desk/layout.types';
import { findLeafWithPanel } from './dock.operations';

/** Desk file ids are `fil_…`; blog posts opened in the editor are `pst_…`. */
const FILE_PANEL_ID = /^([a-z-]+)-((?:fil|pst)_[A-Za-z0-9]+)(?:-\d+)?$/;

export function filePanelId(panelType: string, fileId: string): string {
	return `${panelType}-${fileId}`;
}

/** The file a panel id names, suffix or not; null for a panel that shows no file. */
export function fileIdOfPanel(panelId: string): string | null {
	return FILE_PANEL_ID.exec(panelId)?.[2] ?? null;
}

/** The file a panel shows: its explicit `meta.fileId` first, its id second. */
export function fileIdOfPanelDefinition(panel: PanelDefinition): string | null {
	const meta = panel.meta?.fileId;
	return typeof meta === 'string' ? meta : fileIdOfPanel(panel.id);
}

/**
 * The id of an open panel of `panelType` showing `fileId`, or null. Checks the layout
 * tree, not just the registry — a closed panel stays registered so it can be reopened,
 * but focusing it does nothing.
 */
export function findFilePanel(
	root: LayoutNode,
	panels: Record<string, PanelDefinition>,
	panelType: string,
	fileId: string,
): string | null {
	for (const panel of Object.values(panels)) {
		if (panel.type !== panelType || fileIdOfPanelDefinition(panel) !== fileId) continue;
		if (findLeafWithPanel(root, panel.id)) return panel.id;
	}
	return null;
}
