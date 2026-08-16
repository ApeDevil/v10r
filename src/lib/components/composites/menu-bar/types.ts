export interface MenuBarItem {
	type?: 'item' | 'separator' | 'checkbox';
	label?: string;
	shortcut?: string;
	disabled?: boolean;
	/** CSS icon class (e.g., 'i-lucide-copy') */
	icon?: string;
	checked?: boolean;
	/** Destructive command: danger styling; touch surfaces add an inline confirm step. */
	destructive?: boolean;
	onSelect?: () => void;
}

export interface MenuBarMenu {
	label: string;
	items: MenuBarItem[];
}
