/**
 * Per-panel About text — prose only. Shortcuts are NOT listed here: the About
 * dialog appends a table derived from the panel's composed menus
 * (`shortcutTableMarkdown` in compose-menus.ts), so a chord is declared once, on
 * its menu item, and every projection — kebab, sheet, `?` dialog, About — reads
 * the same declaration. Menu paths are named by direction ("from the File menu"),
 * never spelled as a breadcrumb the menu itself already shows.
 *
 * Every panel type has an entry: the Panel floor menu ends with `About <panel>`
 * only where one exists, and a panel without an About is a panel a person cannot
 * ask about.
 */

import type { DeskPanelType } from './panels';

export interface PanelHelp {
	title: string;
	description: string;
	icon: string;
	/** Markdown string rendered via renderMarkdown() in InfoDialog notes mode */
	notes: string;
}

export const DESK_PANEL_HELP: Record<DeskPanelType, PanelHelp> = {
	explorer: {
		title: 'Explorer',
		description: 'File browser for blog posts, image assets and desk data',
		icon: 'i-lucide-folder-tree',
		notes: `
**Posts** appear as \`.md\` files under \`blog/\`. Click to open in the Editor.

**Assets** appear under \`assets/images/\`. Right-click (or the row's ⋮ on touch) for actions like Insert into Document or Copy URL.

**Data** holds spreadsheets and bot-written documents in folders.

**Create** from the File menu or a folder's context menu — a new post or spreadsheet lands in the selected folder.

**Upload** images by dragging files onto the panel or from the File menu; **import** existing markdown the same way.

Keys act on the focused row: the context menu shows them beside their action.
`,
	},
	editor: {
		title: 'Editor',
		description: 'Markdown editor with live preview and publish workflow',
		icon: 'i-lucide-pen-line',
		notes: `
**Save** from the File menu. The tab dot marks unsaved changes; closing an unsaved editor asks first.

**Publish** or **Update** from the Post menu to make the post public.

**Metadata** opens the side drawer for title, slug, tags and summary.

**Images**: drag from the Explorer, or use its *Insert into Document* action.
`,
	},
	preview: {
		title: 'Preview',
		description: 'Live rendered preview of the active editor document',
		icon: 'i-lucide-eye',
		notes: `
The preview follows the **active editor tab**. Switch editor tabs and the preview updates.

Content refreshes as you type, after a short delay.
`,
	},
	bot: {
		title: 'Bot',
		description: 'The desk assistant — reads what is open, proposes changes you approve',
		icon: 'i-lucide-bot',
		notes: `
The bot sees the panels you **pin to AI context** (Explorer → *Pin to AI Context*) and the open panels' summaries.

**Browsing and creating files is always on.** Editing, deleting and searching pinned files are policy toggles in the Bot Manager (the sliders button beside the input) — each change still arrives as a proposal you approve or reject.

**Start a new conversation** from the Chat menu; the previous one stays in Storage.
`,
	},
	spreadsheet: {
		title: 'Spreadsheet',
		description: 'A grid with formulas, autosaved to your desk',
		icon: 'i-lucide-sheet',
		notes: `
**Edit** a cell by typing, Enter or F2; Escape cancels. Arrow keys, Tab, Home and End move the selection.

**Formulas** start with \`=\`; the formula bar shows the active cell. The status bar sums and counts the selection.

**Saving is automatic.** *Unsaved changes* / *Saved* in the strip above the grid is the truth; if the file changed elsewhere, the strip offers to download your local draft or reload.

**Clear All** from the Sheet menu empties the whole grid and the autosave follows — treat it as destructive.
`,
	},
	markdown: {
		title: 'Document',
		description: 'A read-only view of a desk document',
		icon: 'i-lucide-file-text',
		notes: `
Desk documents are **written by the bot** — ask it to create, extend or rewrite one; each edit arrives as a proposal you approve. This panel shows the current version and reloads when the bot changes the file.

**Read-only by design**: there is no text editor here. To author markdown yourself, use a blog post in the Editor.
`,
	},
	'io-log': {
		title: 'I/O Log',
		description: 'What the desk sent to the bot and what came back',
		icon: 'i-lucide-activity',
		notes: `
Every request, tool call, effect and error of the bot session, newest last — the place to look when an answer seems to ignore a file or a change did not land.

**Clear** from the Log menu empties the view; the server-side record is untouched.
`,
	},
};
