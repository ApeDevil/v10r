/**
 * Keyboard shortcut registry.
 * Central store for all registered shortcuts.
 */

export type ShortcutCategory = 'global' | 'navigation' | 'actions' | 'desk';

export interface Shortcut {
	id: string;
	keys: string; // e.g., 'mod+k', 'g h', 'shift+?'
	description: string;
	category: ShortcutCategory;
	/**
	 * `false` lists the chord in the shortcuts dialog without dispatching it:
	 * another handler owns the keystroke (the desk matches its chords against its
	 * own composed menus), and two dispatchers for one chord would fire twice.
	 */
	dispatch?: false;
	action?: () => void;
}

// Active shortcuts registry
const shortcuts = new Map<string, Shortcut>();

/**
 * Register a keyboard shortcut.
 *
 * @param shortcut - Shortcut configuration
 * @returns Unregister function
 */
export function registerShortcut(shortcut: Shortcut): () => void {
	shortcuts.set(shortcut.id, shortcut);

	// Return unregister function
	return () => {
		shortcuts.delete(shortcut.id);
	};
}

/**
 * Get shortcuts grouped by category.
 */
export function getShortcutsByCategory(): Record<ShortcutCategory, Shortcut[]> {
	const byCategory: Record<ShortcutCategory, Shortcut[]> = {
		global: [],
		navigation: [],
		actions: [],
		desk: [],
	};

	for (const shortcut of shortcuts.values()) {
		byCategory[shortcut.category].push(shortcut);
	}

	return byCategory;
}

/**
 * Find the dispatchable shortcut for a key combination. Display-only entries
 * (`dispatch: false`) never match — their owner handles the keystroke.
 *
 * @param keys - Normalized key string (e.g., 'mod+k')
 * @returns Matching shortcut or undefined
 */
export function findShortcutByKeys(keys: string): Shortcut | undefined {
	for (const shortcut of shortcuts.values()) {
		if (shortcut.dispatch === false) continue;
		if (normalizeKeys(shortcut.keys) === normalizeKeys(keys)) {
			return shortcut;
		}
	}
	return undefined;
}

/**
 * Normalize key string for comparison.
 * Converts to lowercase and sorts modifiers.
 */
function normalizeKeys(keys: string): string {
	// Handle sequences (contains space)
	if (keys.includes(' ')) {
		return keys.toLowerCase();
	}

	// Split, lowercase, and sort (modifiers first, then key)
	const parts = keys.toLowerCase().split('+');
	const modifiers = parts.filter((p) => ['mod', 'ctrl', 'cmd', 'alt', 'shift'].includes(p));
	const key = parts.find((p) => !modifiers.includes(p));

	return [...modifiers.sort(), key].filter(Boolean).join('+');
}
