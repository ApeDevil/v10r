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
import type { DeskEffect } from '$lib/server/ai/tools/_types';
import type { DeskEvents } from './desk-bus.svelte';

/** Callback interface for effect dispatch — abstracts dock/bus calls. */
export interface EffectActions {
	/** Make panelId THE focused panel. Returns false when it is not in the tree. */
	focusPanel: (panelId: string) => boolean;
	addPanel: (panel: PanelDefinition) => void;
	updatePanel: (panelId: string, partial: Partial<PanelDefinition>) => void;
	publish: <K extends keyof DeskEvents>(channel: K, payload: DeskEvents[K]) => void;
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
			const panelId = `${effect.panelType}-${effect.fileId}`;
			if (!actions.focusPanel(panelId)) {
				// addPanel focuses the insertion leaf, so the new panel surfaces too.
				actions.addPanel({
					id: panelId,
					type: effect.panelType,
					label: effect.label,
					closable: true,
					meta: { fileId: effect.fileId },
				});
			}
			return true;
		}
		case 'desk:refresh_file':
			actions.publish('ai:refresh_file', { fileId: effect.fileId });
			return true;
		case 'desk:refresh_explorer':
			actions.publish('ai:refresh_explorer', {} as Record<string, never>);
			return true;
		case 'desk:tab_indicator':
			actions.updatePanel(`${effect.panelType}-${effect.fileId}`, {
				indicator: effect.variant === 'modified' ? 'ai-modified' : undefined,
			});
			return true;
		case 'desk:notify':
			actions.publish('ai:notify', { message: effect.message, level: effect.level });
			return true;
		case 'desk:activate_panel':
		case 'desk:focus_panel':
			return actions.focusPanel(effect.panelId);
		case 'desk:scroll_to':
			// Focus first — a scroll inside a background tab is invisible on every surface.
			actions.focusPanel(effect.panelId);
			actions.publish('ai:scroll_to', { panelId: effect.panelId, target: effect.target });
			return true;
		default:
			// Unknown effect — report as not applied so the caller can log it.
			return false;
	}
}
