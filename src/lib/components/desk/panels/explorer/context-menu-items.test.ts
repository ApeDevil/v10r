import { describe, expect, it } from 'vitest';
import { buildContextMenuItems, type MenuItemDef, treeKeyOf } from './context-menu-items';
import type { ExplorerNode, NodeCapability } from './node';

function node(capabilities: NodeCapability[]): ExplorerNode {
	return {
		id: 'n1',
		parentId: null,
		source: 'blog-post',
		sourceData: {},
		label: 'post.md',
		icon: 'i-lucide-file',
		isFolder: false,
		capabilities: new Set(capabilities),
		sortKey: 'post',
	};
}

describe('explorer context menu — declared tree keys', () => {
	it('declares F2 on Rename and M on Move to…, and the tree reads the same declaration', () => {
		const items = buildContextMenuItems(node(['rename', 'move', 'delete'])).filter(
			(i): i is MenuItemDef => i.type === 'item',
		);
		const byLabel = new Map(items.map((i) => [i.label, i]));
		expect(byLabel.get('Rename')).toMatchObject({ shortcut: 'F2', action: 'rename' });
		expect(byLabel.get('Move to…')).toMatchObject({ shortcut: 'M', action: 'moveRequest' });
		expect(byLabel.get('Delete')?.shortcut).toBeUndefined();
		expect(treeKeyOf('rename')).toBe('F2');
		expect(treeKeyOf('moveRequest')).toBe('M');
		expect(treeKeyOf('delete')).toBeNull();
	});

	it('omits the key with the item — a node that cannot be renamed shows no F2', () => {
		const items = buildContextMenuItems(node(['open', 'delete']));
		expect(items.some((i) => i.type === 'item' && i.shortcut)).toBe(false);
	});
});
