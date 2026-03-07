export interface SelectionBarAction {
	label: string;
	/** CSS icon class (e.g., 'i-lucide-trash-2') */
	icon?: string;
	variant?: 'default' | 'destructive';
	onclick: () => void;
	disabled?: boolean;
}
