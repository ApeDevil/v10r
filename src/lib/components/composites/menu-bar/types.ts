export interface MenuBarItem {
	type?: 'item' | 'separator' | 'checkbox' | 'radio';
	label?: string;
	shortcut?: string;
	disabled?: boolean;
	/** CSS icon class (e.g., 'i-lucide-copy') */
	icon?: string;
	checked?: boolean;
	onSelect?: () => void;
}

export interface MenuBarMenu {
	label: string;
	items: MenuBarItem[];
}
