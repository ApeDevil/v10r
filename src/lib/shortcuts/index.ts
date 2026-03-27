/**
 * Keyboard shortcuts system.
 * Exports all shortcuts functionality.
 */

export { initKeyboardHandler } from './handler';
export { formatShortcut, getModifierKey } from './platform';
export type { Shortcut, ShortcutCategory } from './registry';
export {
	findShortcutByKeys,
	getShortcuts,
	getShortcutsByCategory,
	registerShortcut,
} from './registry';
