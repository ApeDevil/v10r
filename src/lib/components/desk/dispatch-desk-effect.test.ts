import { describe, expect, it, vi } from 'vitest';
import type { DeskEffect } from '$lib/server/ai/tools/_types';
import { makeMockActions } from './desk-context.fixtures';
import { dispatchDeskEffect } from './dispatch-desk-effect';

describe('dispatchDeskEffect', () => {
	it('desk:open_panel adds panel when focusPanel reports it absent', () => {
		const actions = makeMockActions(vi, false);
		const effect: DeskEffect = {
			type: 'desk:open_panel',
			panelType: 'spreadsheet',
			fileId: 'f1',
			label: 'Budget',
		};
		expect(dispatchDeskEffect(effect, actions)).toBe(true);

		expect(actions.focusPanel).toHaveBeenCalledWith('spreadsheet-f1');
		expect(actions.addPanel).toHaveBeenCalledWith({
			id: 'spreadsheet-f1',
			type: 'spreadsheet',
			label: 'Budget',
			closable: true,
			meta: { fileId: 'f1' },
		});
	});

	it('desk:open_panel focuses existing panel instead of adding', () => {
		const actions = makeMockActions(vi, true);
		const effect: DeskEffect = {
			type: 'desk:open_panel',
			panelType: 'spreadsheet',
			fileId: 'f1',
			label: 'Budget',
		};
		expect(dispatchDeskEffect(effect, actions)).toBe(true);

		expect(actions.focusPanel).toHaveBeenCalledWith('spreadsheet-f1');
		expect(actions.addPanel).not.toHaveBeenCalled();
	});

	it('desk:activate_panel reports false when the panel is absent', () => {
		const actions = makeMockActions(vi, false);
		expect(dispatchDeskEffect({ type: 'desk:activate_panel', panelId: 'editor-x' }, actions)).toBe(false);
		expect(actions.focusPanel).toHaveBeenCalledWith('editor-x');
	});

	it('desk:focus_panel focuses an existing panel and reports true', () => {
		const actions = makeMockActions(vi, true);
		expect(dispatchDeskEffect({ type: 'desk:focus_panel', panelId: 'editor-x' }, actions)).toBe(true);
		expect(actions.focusPanel).toHaveBeenCalledWith('editor-x');
	});

	it('desk:refresh_file publishes to bus', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect({ type: 'desk:refresh_file', fileId: 'f1' }, actions);

		expect(actions.publish).toHaveBeenCalledWith('ai:refresh_file', { fileId: 'f1' });
	});

	it('desk:refresh_explorer publishes to bus', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect({ type: 'desk:refresh_explorer' }, actions);

		expect(actions.publish).toHaveBeenCalledWith('ai:refresh_explorer', expect.anything());
	});

	it('desk:tab_indicator updates panel with ai-modified', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect(
			{ type: 'desk:tab_indicator', fileId: 'f1', panelType: 'spreadsheet', variant: 'modified' },
			actions,
		);

		expect(actions.updatePanel).toHaveBeenCalledWith('spreadsheet-f1', { indicator: 'ai-modified' });
	});

	it('desk:tab_indicator clears indicator for non-modified variant', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect({ type: 'desk:tab_indicator', fileId: 'f1', panelType: 'editor', variant: 'created' }, actions);

		expect(actions.updatePanel).toHaveBeenCalledWith('editor-f1', { indicator: undefined });
	});

	it('desk:notify publishes to bus with level', () => {
		const actions = makeMockActions(vi);
		dispatchDeskEffect({ type: 'desk:notify', message: 'Done!', level: 'success' }, actions);

		expect(actions.publish).toHaveBeenCalledWith('ai:notify', { message: 'Done!', level: 'success' });
	});

	it('desk:scroll_to focuses the target panel BEFORE publishing', () => {
		const actions = makeMockActions(vi, true);
		const order: string[] = [];
		(actions.focusPanel as ReturnType<typeof vi.fn>).mockImplementation(() => {
			order.push('focus');
			return true;
		});
		(actions.publish as ReturnType<typeof vi.fn>).mockImplementation(() => {
			order.push('publish');
		});
		dispatchDeskEffect({ type: 'desk:scroll_to', panelId: 'editor-f1', target: 'heading-2' }, actions);

		expect(order).toEqual(['focus', 'publish']);
		expect(actions.publish).toHaveBeenCalledWith('ai:scroll_to', { panelId: 'editor-f1', target: 'heading-2' });
	});

	it('unknown effect type reports not-applied', () => {
		const actions = makeMockActions(vi);
		const effect = { type: 'desk:unknown_future_effect' } as unknown as DeskEffect;
		expect(dispatchDeskEffect(effect, actions)).toBe(false);

		expect(actions.addPanel).not.toHaveBeenCalled();
		expect(actions.publish).not.toHaveBeenCalled();
		expect(actions.updatePanel).not.toHaveBeenCalled();
	});

	it('null/undefined effect does not throw and reports not-applied', () => {
		const actions = makeMockActions(vi);
		expect(dispatchDeskEffect(null as unknown as DeskEffect, actions)).toBe(false);
		expect(dispatchDeskEffect(undefined as unknown as DeskEffect, actions)).toBe(false);
	});
});
