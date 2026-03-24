import type { DeskPanelType } from './desk-panels';

export interface PanelHelp {
	title: string;
	description: string;
	icon: string;
	/** Markdown string rendered via renderMarkdown() in InfoDialog notes mode */
	notes: string;
}

export const DESK_PANEL_HELP: Partial<Record<DeskPanelType, PanelHelp>> = {
	explorer: {
		title: 'Explorer',
		description: 'File browser for blog posts and image assets',
		icon: 'i-lucide-folder-tree',
		notes: `
**Posts** appear as \`.md\` files under \`blog/\`. Click to open in the Editor.

**Assets** appear under \`assets/images/\`. Right-click for actions like Insert or Copy Markdown Link.

**Upload** images by dragging files onto the Explorer panel or using **File > Upload Image**.

**Import** existing markdown files via **File > Import from Markdown**.

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New Post |
| Drag & Drop | Upload images |
`,
	},
	editor: {
		title: 'Editor',
		description: 'Markdown editor with live preview and publish workflow',
		icon: 'i-lucide-pen-line',
		notes: `
**Save** with \`Ctrl+S\` or **File > Save**. The tab dot indicates unsaved changes.

**Publish** via **Post > Publish** to make the post publicly accessible.

**Metadata** (\`Ctrl+,\`) opens the side drawer for title, slug, tags, and summary.

**Images**: drag from Explorer or use the Copy Markdown Link context menu action.

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save |
| Ctrl+, | Open Metadata |
| Ctrl+Shift+X | Export as Markdown |
`,
	},
	preview: {
		title: 'Preview',
		description: 'Live rendered preview of the active editor document',
		icon: 'i-lucide-eye',
		notes: `
The preview automatically follows the **active editor tab**. Switch editor tabs and the preview updates.

Content refreshes as you type with a short debounce delay.
`,
	},
};
