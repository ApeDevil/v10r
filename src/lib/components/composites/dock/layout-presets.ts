import type { LayoutNode, PanelDefinition } from './dock.types';

export interface LayoutPreset {
	id: string;
	label: string;
	icon: string;
	buildLayout: (context?: { documentId?: string }) => {
		root: LayoutNode;
		panels: Record<string, PanelDefinition>;
	};
}

/** Writing layout: Documents | Editor | Preview */
const writingPreset: LayoutPreset = {
	id: 'writing',
	label: 'Writing',
	icon: 'i-lucide-pen-line',
	buildLayout(context) {
		const editorId = context?.documentId ? `editor-${context.documentId}` : 'editor';
		const panels: Record<string, PanelDefinition> = {
			documents: { id: 'documents', type: 'documents', label: 'Documents', icon: 'i-lucide-file-text', closable: true },
			[editorId]: { id: editorId, type: 'editor', label: 'Editor', icon: 'i-lucide-pen-line', closable: true },
			preview: { id: 'preview', type: 'preview', label: 'Preview', icon: 'i-lucide-eye', closable: true },
		};

		const root: LayoutNode = {
			type: 'split',
			id: 'writing-root',
			direction: 'horizontal',
			sizes: [20, 80],
			children: [
				{
					type: 'leaf',
					id: 'writing-docs',
					tabs: ['documents'],
					activeTab: 'documents',
				},
				{
					type: 'split',
					id: 'writing-main',
					direction: 'horizontal',
					sizes: [50, 50],
					children: [
						{
							type: 'leaf',
							id: 'writing-editor',
							tabs: [editorId],
							activeTab: editorId,
						},
						{
							type: 'leaf',
							id: 'writing-preview',
							tabs: ['preview'],
							activeTab: 'preview',
						},
					],
				},
			],
		};

		return { root, panels };
	},
};

export const LAYOUT_PRESETS: LayoutPreset[] = [writingPreset];
