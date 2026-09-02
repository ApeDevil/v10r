/**
 * Keyboard shortcuts system.
 * Exports all shortcuts functionality.
 */

export { initKeyboardHandler } from './keyboard';
export { formatShortcut } from './platform';
export type { Shortcut, ShortcutCategory } from './registry';
export { findShortcutByKeys, getShortcutsByCategory, registerShortcut } from './registry';
