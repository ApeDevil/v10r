import { cva, type VariantProps } from 'class-variance-authority';

export const kbdVariants = cva(
	'inline-flex items-center gap-1 font-mono rounded border border-border bg-subtle text-muted shadow-sm',
	{
		variants: {
			size: {
				sm: 'text-fluid-xs px-1 py-0.5',
				md: 'text-fluid-sm px-1.5 py-0.5',
				lg: 'text-fluid-base px-2 py-1'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export type KbdVariants = VariantProps<typeof kbdVariants>;

/**
 * Map common key names to their display labels (Linux/Windows style)
 */
export const keySymbols: Record<string, string> = {
	// Modifiers
	cmd: 'Ctrl',
	meta: 'Ctrl',
	command: 'Ctrl',
	ctrl: 'Ctrl',
	control: 'Ctrl',
	alt: 'Alt',
	option: 'Alt',
	shift: '⇧',
	// Enter
	enter: '⏎',
	return: '⏎',
	// Backspace/Delete
	backspace: '⌫',
	delete: 'Del',
	// Escape
	escape: 'Esc',
	esc: 'Esc',
	// Tab
	tab: '⇥',
	// Space
	space: 'Space',
	// Arrows
	up: '↑',
	down: '↓',
	left: '←',
	right: '→'
};

/**
 * Convert a key string to its display symbol
 */
export function getKeySymbol(key: string): string {
	const normalized = key.toLowerCase();
	return keySymbols[normalized] ?? key;
}
