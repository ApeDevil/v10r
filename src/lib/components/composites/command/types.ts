export interface CommandItem {
	id: string;
	label: string;
	/** CSS icon class (e.g., 'i-lucide-home') */
	icon?: string;
	/** Sub-label hint (e.g., "Settings / Display") */
	hint?: string;
	/** Extra search keywords not shown in UI */
	keywords?: string[];
	shortcut?: string;
	disabled?: boolean;
	onSelect?: () => void;
	href?: string;
}

export interface CommandGroup {
	heading: string;
	items: CommandItem[];
}
