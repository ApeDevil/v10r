/** Paraglide message functions are () => string. Storing the function reference lets
 *  consumers call `item.label()` at render time and pick up the current locale. */
export type LabelFn = () => string;

export interface NavChild {
	href: string;
	label: LabelFn;
}

export interface NavItem {
	href: string;
	label: LabelFn;
	/** UnoCSS icon class (e.g., 'i-lucide-home') */
	icon: string;
	children?: NavChild[];
}
