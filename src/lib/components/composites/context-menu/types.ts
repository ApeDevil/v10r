export interface ContextMenuItem {
	label: string;
	/** CSS icon class (e.g., 'i-lucide-home') */
	icon?: string;
	shortcut?: string;
	onclick?: () => void;
	separator?: boolean;
	disabled?: boolean;
}
