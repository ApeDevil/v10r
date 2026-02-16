export interface NavChild {
	href: string;
	label: string;
}

export interface NavItem {
	href: string;
	label: string;
	/** UnoCSS icon class (e.g., 'i-lucide-home') */
	icon: string;
	children?: NavChild[];
}
