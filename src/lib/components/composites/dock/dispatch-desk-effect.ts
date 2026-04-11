/**
 * Pure dispatch function for DeskEffect → dock/bus mutations.
 *
 * Extracted from ChatPanel.svelte for testability. Each effect type
 * maps to a dock state mutation or bus publication.
 */

import type { DeskEffect } from '$lib/server/ai/tools/_types';
import type { DeskEvents } from './desk-bus.svelte';
import type { LayoutNode, LeafNode, PanelDefinition } from './dock.types';

/** Callback interface for effect dispatch — abstracts dock/bus calls. */
export interface EffectActions {
	findLeafWithPanel: (root: LayoutNode, panelId: string) => LeafNode | null;
	activateTab: (leafId: string, panelId: string) => void;
	addPanel: (panel: PanelDefinition) => void;
	updatePanel: (panelId: string, partial: Partial<PanelDefinition>) => void;
	publish: <K extends keyof DeskEvents>(channel: K, payload: DeskEvents[K]) => void;
}

/**
 * Dispatch a single DeskEffect to the dock/bus layer.
 * Unknown effect types are silently ignored (defensive).
 */
export function dispatchDeskEffect(
	effect: DeskEffect,
	actions: EffectActions,
	root: LayoutNode,
): void {
	if (!effect?.type) return;

	switch (effect.type) {
		case 'desk:open_panel': {
			const panelId = `${effect.panelType}-${effect.fileId}`;
			const existingLeaf = actions.findLeafWithPanel(root, panelId);
			if (existingLeaf) {
				actions.activateTab(existingLeaf.id, panelId);
			} else {
				actions.addPanel({
					id: panelId,
					type: effect.panelType,
					label: effect.label,
					closable: true,
					meta: { fileId: effect.fileId },
				});
			}
			break;
		}
		case 'desk:refresh_file':
			actions.publish('ai:refresh_file', { fileId: effect.fileId });
			break;
		case 'desk:refresh_explorer':
			actions.publish('ai:refresh_explorer', {} as Record<string, never>);
			break;
		case 'desk:tab_indicator':
			actions.updatePanel(`${effect.panelType}-${effect.fileId}`, {
				indicator: effect.variant === 'modified' ? 'ai-modified' : undefined,
			});
			break;
		case 'desk:notify':
			actions.publish('ai:notify', { message: effect.message, level: effect.level });
			break;
		case 'desk:activate_panel':
		case 'desk:focus_panel': {
			const leaf = actions.findLeafWithPanel(root, effect.panelId);
			if (leaf) {
				actions.activateTab(leaf.id, effect.panelId);
			}
			break;
		}
		case 'desk:scroll_to':
			actions.publish('ai:scroll_to', { panelId: effect.panelId, target: effect.target });
			break;
		default:
			// Unknown effect — silently ignore (defensive)
			break;
	}
}
