import { describe, expect, it, vi } from 'vitest';
import type { DeskEffect } from '$lib/server/ai/tools/_types';
import { makeMockActions } from './desk-context.fixtures';
import { dispatchDeskEffect } from './dispatch-desk-effect';
import type { LeafNode } from './dock.types';

const root: LeafNode = { type: 'leaf', id: 'l1', tabs: ['p1'], activeTab: 'p1' };

describe('dispatchDeskEffect', () => {
	it('desk:open_panel adds panel when not found', () => {
		const actions = makeMockActions(vi, null);
		const effect: DeskEffect = {
			type: 'desk:open_panel',
			panelType: 'spreadsheet',
			fileId: 'f1',
			label: 'Budget',
		};
		dispatchDeskEffect(effect, actions, root);

		expect(actions.addPanel).toHaveBeenCalledWith({
			id: 'spreadsheet-f1',
			type: 'spreadsheet',
			label: 'Budget',
			closable: true,
			meta: { fileId: 'f1' },
		});
		expect(actions.activateTab).not.toHaveBeenCalled();
	});

	it('desk:open_panel activates existing panel instead of adding', () => {
		const actions = makeMockActions(vi, { id: 'l1', panelId: 'spreadsheet-f1' });
		const effect: DeskEffect = {
			type: 'desk:open_panel',
			panelType: 'spreadsheet',
			fileId: 'f1',
			label: 'Budget',
		};
		dispatchDeskEffect(effect, actions, root);

		expect(actions.activateTab).toHaveBeenCalledWith('l1', 'spreadsheet-f1');
		expect(actions.addPanel).not.toHaveBeenCalled();
	});

	it('desk:refresh_file publishes to bus', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect({ type: 'desk:refresh_file', fileId: 'f1' }, actions, root);

		expect(actions.publish).toHaveBeenCalledWith('ai:refresh_file', { fileId: 'f1' });
	});

	it('desk:refresh_explorer publishes to bus', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect({ type: 'desk:refresh_explorer' }, actions, root);

		expect(actions.publish).toHaveBeenCalledWith('ai:refresh_explorer', expect.anything());
	});

	it('desk:tab_indicator updates panel with ai-modified', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect(
			{ type: 'desk:tab_indicator', fileId: 'f1', panelType: 'spreadsheet', variant: 'modified' },
			actions,
			root,
		);

		expect(actions.updatePanel).toHaveBeenCalledWith('spreadsheet-f1', { indicator: 'ai-modified' });
	});

	it('desk:tab_indicator clears indicator for non-modified variant', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect(
			{ type: 'desk:tab_indicator', fileId: 'f1', panelType: 'editor', variant: 'created' },
			actions,
			root,
		);

		expect(actions.updatePanel).toHaveBeenCalledWith('editor-f1', { indicator: undefined });
	});

	it('desk:notify publishes to bus with level', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect(
			{ type: 'desk:notify', message: 'Done!', level: 'success' },
			actions,
			root,
		);

		expect(actions.publish).toHaveBeenCalledWith('ai:notify', { message: 'Done!', level: 'success' });
	});

	it('unknown effect type is silently ignored', () => {
		const actions = makeMockActions(vi);
		const effect = { type: 'desk:unknown_future_effect' } as unknown as DeskEffect;
		dispatchDeskEffect(effect, actions, root);

		expect(actions.addPanel).not.toHaveBeenCalled();
		expect(actions.publish).not.toHaveBeenCalled();
		expect(actions.updatePanel).not.toHaveBeenCalled();
	});

	it('null/undefined effect does not throw', () => {
		const actions = makeMockActions(vi);
		expect(() => dispatchDeskEffect(null as unknown as DeskEffect, actions, root)).not.toThrow();
		expect(() => dispatchDeskEffect(undefined as unknown as DeskEffect, actions, root)).not.toThrow();
	});
});
