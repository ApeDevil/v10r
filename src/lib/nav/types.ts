/** Paraglide message functions are () => string. Storing the function reference lets
 *  consumers call `item.label()` at render time and pick up the current locale. */
export type LabelFn = () => string;

export interface NavChild {
	href: string;
	label: LabelFn;
	/**
	 * The direction this child belongs to. Consecutive children sharing a group
	 * render under one heading row in the flyout and the drawer accordion — rows
	 * stay rows, nothing nests, so a long list becomes scannable without a click.
	 */
	group?: LabelFn;
}

export interface NavItem {
	href: string;
	label: LabelFn;
	/** UnoCSS icon class (e.g., 'i-lucide-home') */
	icon: string;
	children?: NavChild[];
}
