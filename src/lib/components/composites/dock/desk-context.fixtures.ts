/**
 * Test fixtures for desk context tests.
 * Factory functions for PanelContext, mock bus, and mock dock.
 */

import type { Mock } from 'vitest';
import type { PanelContext } from './desk-context.svelte';
import type { EffectActions } from './dispatch-desk-effect';

let counter = 0;

/** Create a PanelContext with sensible defaults. Override any field. */
export function makePanelContext(overrides?: Partial<PanelContext>): PanelContext {
	const id = `panel-${++counter}`;
	const content = overrides?.content ?? 'test content';
	return {
		panelId: id,
		panelType: 'spreadsheet',
		label: 'Test Panel',
		content,
		tokenEstimate: Math.ceil(content.length / 4),
		updatedAt: 0,
		...overrides,
	};
}

/** Build a Map registry from an array of PanelContexts. */
export function makeRegistry(...panels: PanelContext[]): Map<string, PanelContext> {
	return new Map(panels.map((p) => [p.panelId, p]));
}

/** Create a mock EffectActions object with vi.fn() stubs. */
export function makeMockActions(
	vi: { fn: () => Mock },
	leafOverride?: { id: string; panelId: string } | null,
): EffectActions {
	return {
		findLeafWithPanel: vi
			.fn()
			.mockReturnValue(
				leafOverride
					? { type: 'leaf', id: leafOverride.id, tabs: [leafOverride.panelId], activeTab: leafOverride.panelId }
					: null,
			),
		activateTab: vi.fn(),
		addPanel: vi.fn(),
		updatePanel: vi.fn(),
		publish: vi.fn(),
	};
}

/** Pre-built sample contexts for common panel types. */
export const SAMPLES = {
	spreadsheet: () =>
		makePanelContext({
			panelId: 'spreadsheet-f1',
			panelType: 'spreadsheet',
			label: 'Q4 Budget',
			content: 'A1: Revenue\nB1: 450000\nA2: Costs\nB2: 320000',
			tokenEstimate: 12,
		}),
	markdown: () =>
		makePanelContext({
			panelId: 'editor-f2',
			panelType: 'editor',
			label: 'Meeting Notes',
			content: '# Sprint Retro\n\n- Deployed auth flow\n- Reduced cold start 40%',
			tokenEstimate: 15,
		}),
	explorer: () =>
		makePanelContext({
			panelId: 'explorer',
			panelType: 'explorer',
			label: 'Explorer',
			content: 'files: budget.csv, notes.md, config.ts',
			tokenEstimate: 10,
		}),
} as const;
