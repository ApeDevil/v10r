export interface MenuBarItem {
	type?: 'item' | 'separator' | 'checkbox';
	label?: string;
	shortcut?: string;
	disabled?: boolean;
	/** CSS icon class (e.g., 'i-lucide-copy') */
	icon?: string;
	checked?: boolean;
	/**
	 * Destructive command: danger styling on every projection. Styling only —
	 * a command whose mistake cannot be undone confirms in its own handler.
	 */
	destructive?: boolean;
	onSelect?: () => void;
}

export interface MenuBarMenu {
	label: string;
	items: MenuBarItem[];
}
