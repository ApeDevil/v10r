export interface QuickSearchItem {
	id: string;
	type: 'page' | 'action' | 'recent' | 'panel';
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
	/** Sub-label hint (e.g., "DB / Relational") */
	hint?: string;
}
