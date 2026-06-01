/** Display group for an item. Command items (panel/action/recent) are filtered
 *  client-side; search surfaces (page/showcase/section/doc/blog) arrive already
 *  matched by the search engine and are rendered as-is. */
export type CommandPaletteItemType = 'page' | 'action' | 'recent' | 'panel' | 'showcase' | 'section' | 'doc' | 'blog';

export interface CommandPaletteItem {
	id: string;
	type: CommandPaletteItemType;
	label: string;
	/** CSS icon class (e.g., 'i-lucide-home') */
	icon: string;
	href?: string;
	action?: () => void;
	secondary?: {
		icon: string;
		label: string;
		action: () => void;
	};
	/** Sub-label hint / breadcrumb (e.g., "Docs / Stack"). */
	hint?: string;
	shortcut?: string;
	/** Plain-text excerpt (search results); rendered with highlighted ranges. */
	snippet?: string;
	/** Character ranges into `snippet` to wrap in `<mark>`. */
	highlight?: [number, number][];
	/** "EN" badge for English content shown to a de/ru user. */
	badge?: 'en-fallback' | null;
}
