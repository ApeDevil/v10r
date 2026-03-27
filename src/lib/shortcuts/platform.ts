/**
 * Keyboard shortcut formatting (Linux/Windows).
 */

/**
 * Get the modifier key label.
 */
export function getModifierKey(): 'Ctrl' {
	return 'Ctrl';
}

/**
 * Format shortcut string for display.
 * Converts 'mod+k' → 'Ctrl+K'.
 * Converts 'g h' → 'G then H' for sequences.
 *
 * @param shortcut - Raw shortcut string (e.g., 'mod+k', 'shift+/', 'g h')
 */
export function formatShortcut(shortcut: string): string {
	// Handle key sequences (contains space)
	if (shortcut.includes(' ')) {
		return shortcut
			.split(' ')
			.map((k) => k.toUpperCase())
			.join(' then ');
	}

	// Replace 'mod' with Ctrl
	const normalized = shortcut.replace(/mod/i, 'ctrl');

	// Split into parts
	const parts = normalized.split('+');

	// Format each part
	const formatted = parts.map((part) => {
		const lower = part.toLowerCase();

		switch (lower) {
			case 'cmd':
			case 'ctrl':
				return 'Ctrl';
			case 'alt':
				return 'Alt';
			case 'shift':
				return '⇧';
			case 'escape':
			case 'esc':
				return 'Esc';
			default:
				return part.length === 1 ? part.toUpperCase() : part;
		}
	});

	return formatted.join('+');
}
