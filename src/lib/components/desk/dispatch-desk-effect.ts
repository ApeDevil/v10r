/**
 * Pure dispatch function for DeskEffect → dock/bus mutations.
 *
 * Extracted from ChatPanel.svelte for testability. Each effect type
 * maps to a dock state mutation or bus publication.
 *
 * Contract: an effect that surfaces a panel must leave that panel the user's
 * current panel on EVERY surface — `focusPanel` is the one verb for that
 * (desktop activates + focuses the leaf; the mobile visible panel derives
 * from the same focus). Overlay auto-close reacts to the focus change in the
 * mobile view; the dispatcher stays surface-free.
 */

import type { PanelDefinition } from '$lib/desk/layout.types';
import type { DeskEffect } from '$lib/types/ai-tools';
import type { DeskEvents } from './desk-bus.svelte';
import { filePanelId } from './file-panel';

/** Callback interface for effect dispatch — abstracts dock/bus calls. */
export interface EffectActions {
	/** Make panelId THE focused panel. Returns false when it is not in the tree. */
	focusPanel: (panelId: string) => boolean;
	addPanel: (panel: PanelDefinition) => void;
	updatePanel: (panelId: string, partial: Partial<PanelDefinition>) => void;
	publish: <K extends keyof DeskEvents>(channel: K, payload: DeskEvents[K]) => void;
	/**
	 * The id of the OPEN panel of this type showing this file, or null. The Explorer mints
	 * suffixed ids for second instances, so an effect must ask rather than assume — an
	 * assumed id opened a file that was already on screen a second time.
	 */
	findFilePanel: (panelType: string, fileId: string) => string | null;
}

/**
 * Dispatch a single DeskEffect to the dock/bus layer.
 * Returns false for unknown or inapplicable effects (target panel absent) so
 * the caller can log the failure — a desk effect that did nothing must never
 * be indistinguishable from one that worked.
 */
export function dispatchDeskEffect(effect: DeskEffect, actions: EffectActions): boolean {
	if (!effect?.type) return false;

	switch (effect.type) {
		case 'desk:open_panel': {
			const open = actions.findFilePanel(effect.panelType, effect.fileId);
			if (open) return actions.focusPanel(open);
			// addPanel focuses the insertion leaf, so the new panel surfaces too.
			actions.addPanel({
				id: filePanelId(effect.panelType, effect.fileId),
				type: effect.panelType,
				label: effect.label,
				closable: true,
				meta: { fileId: effect.fileId },
			});
			return true;
		}
		case 'desk:refresh_file':
			actions.publish('ai:refresh_file', { fileId: effect.fileId });
			return true;
		case 'desk:refresh_explorer':
			actions.publish('ai:refresh_explorer', {} as Record<string, never>);
			return true;
		case 'desk:tab_indicator': {
			const open = actions.findFilePanel(effect.panelType, effect.fileId);
			// A file with no open panel has no tab to mark; that is not a failure.
			if (open) actions.updatePanel(open, { indicator: effect.variant === 'modified' ? 'ai-modified' : undefined });
			return true;
		}
		default:
			// Unknown effect — report as not applied so the caller can log it.
			return false;
	}
}
