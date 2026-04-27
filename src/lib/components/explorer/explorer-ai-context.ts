/**
 * EXPLORER AI CONTEXT — serialize explorer tree as AI panel context.
 *
 * Pure functions — no reactive state of their own. The panel calls these from
 * inside its `$effect` blocks so the AI sidebar always sees an up-to-date
 * snapshot of what's in the workspace.
 */
import { registerPanelContext, updatePanelContext } from '$lib/components/composites/dock';
import type { ExplorerState } from './explorer-state.svelte';

export function serializeExplorerContext(state: ExplorerState): string {
	const allNodes = [...state.nodes.values()];
	if (!allNodes.length) return 'Explorer: loading...';
	const lines = allNodes
		.filter((n) => n.source !== 'virtual')
		.map((n) => {
			const ancestors = state
				.getBreadcrumbPath(n.id)
				.filter((a) => a.source !== 'virtual')
				.map((a) => a.label);
			const path = ancestors.length > 0 ? `${ancestors.join('/')}/${n.label}` : n.label;
			const prefix = n.isFolder ? 'folder' : n.source;
			return `- ${path} (${prefix}:${n.id})`;
		});
	return `Workspace files (${lines.length} items):\n${lines.join('\n')}`;
}

/**
 * Register the explorer panel with the dock's AI context system. Returns the
 * cleanup function from `registerPanelContext` — wire into `$effect` directly.
 */
export function registerExplorerAiContext(state: ExplorerState): () => void {
	const content = serializeExplorerContext(state);
	return registerPanelContext({
		panelId: 'explorer',
		panelType: 'explorer',
		label: 'Explorer',
		content,
		tokenEstimate: Math.ceil(content.length / 4),
		updatedAt: Date.now(),
		contentType: 'structured',
	});
}

/** Push a fresh snapshot of the explorer tree into the dock's AI context. */
export function updateExplorerAiContext(state: ExplorerState): void {
	const content = serializeExplorerContext(state);
	updatePanelContext('explorer', {
		content,
		tokenEstimate: Math.ceil(content.length / 4),
	});
}
