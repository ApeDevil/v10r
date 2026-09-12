import { describe, expect, it } from 'vitest';
import type { LayoutNode } from '$lib/desk/layout.types';
import { fileIdOfPanel, fileIdOfPanelDefinition, filePanelId, findFilePanel } from './file-panel';

describe('file panel identity', () => {
	it('reads the file id from a canonical id, a suffixed second instance, and a post editor', () => {
		expect(fileIdOfPanel(filePanelId('spreadsheet', 'fil_abc'))).toBe('fil_abc');
		expect(fileIdOfPanel('spreadsheet-fil_abc-1725000000000')).toBe('fil_abc');
		expect(fileIdOfPanel('editor-pst_x1-1725000000000')).toBe('pst_x1');
		expect(fileIdOfPanel('explorer')).toBeNull();
		expect(fileIdOfPanel('bot-1725000000000')).toBeNull();
	});

	it('prefers an explicit meta.fileId over the id', () => {
		expect(fileIdOfPanelDefinition({ id: 'markdown-x', type: 'markdown', label: 'n', meta: { fileId: 'fil_m' } })).toBe(
			'fil_m',
		);
		expect(fileIdOfPanelDefinition({ id: 'markdown-fil_z', type: 'markdown', label: 'n' })).toBe('fil_z');
	});

	it('finds the OPEN instance showing a file, whatever its id suffix, and ignores closed ones', () => {
		const root: LayoutNode = {
			type: 'leaf',
			id: 'l1',
			tabs: ['spreadsheet-fil_a-99', 'explorer'],
			activeTab: 'explorer',
		};
		const panels = {
			explorer: { id: 'explorer', type: 'explorer', label: 'Explorer' },
			'spreadsheet-fil_a-99': { id: 'spreadsheet-fil_a-99', type: 'spreadsheet', label: 'A' },
			'spreadsheet-fil_b': { id: 'spreadsheet-fil_b', type: 'spreadsheet', label: 'B (closed)' },
		};
		expect(findFilePanel(root, panels, 'spreadsheet', 'fil_a')).toBe('spreadsheet-fil_a-99');
		expect(findFilePanel(root, panels, 'spreadsheet', 'fil_b')).toBeNull();
		expect(findFilePanel(root, panels, 'markdown', 'fil_a')).toBeNull();
	});
});
