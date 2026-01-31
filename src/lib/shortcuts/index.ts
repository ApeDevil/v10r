/**
 * Keyboard shortcuts system.
 * Exports all shortcuts functionality.
 */

export { isMac, getModifierKey, formatShortcut } from './platform';
export {
	registerShortcut,
	getShortcuts,
	getShortcutsByCategory,
	findShortcutByKeys,
} from './registry';
export { initKeyboardHandler } from './handler';
export type { Shortcut, ShortcutCategory } from './registry';
