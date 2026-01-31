/**
 * Platform detection for keyboard shortcuts.
 * Handles Cmd/Ctrl differences between macOS and other platforms.
 */

import { browser } from '$app/environment';

/**
 * Detect if running on macOS.
 */
export function isMac(): boolean {
	if (!browser) return false;
	return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Get the platform-appropriate modifier key.
 */
export function getModifierKey(): 'Cmd' | 'Ctrl' {
	return isMac() ? 'Cmd' : 'Ctrl';
}

/**
 * Format shortcut string for display.
 * Converts 'mod+k' → '⌘K' on Mac or 'Ctrl+K' on other platforms.
 * Converts 'g h' → 'g then h' for sequences.
 *
 * @param shortcut - Raw shortcut string (e.g., 'mod+k', 'shift+/', 'g h')
 */
export function formatShortcut(shortcut: string): string {
	const mac = isMac();

	// Handle key sequences (contains space)
	if (shortcut.includes(' ')) {
		return shortcut
			.split(' ')
			.map((k) => k.toUpperCase())
			.join(' then ');
	}

	// Replace 'mod' with platform-appropriate modifier
	const normalized = shortcut.replace(/mod/i, mac ? 'cmd' : 'ctrl');

	// Split into parts
	const parts = normalized.split('+');

	// Format each part
	const formatted = parts.map((part) => {
		const lower = part.toLowerCase();

		// Map to symbols (Mac) or capitalized text (other platforms)
		switch (lower) {
			case 'cmd':
				return mac ? '⌘' : 'Cmd';
			case 'ctrl':
				return mac ? '⌃' : 'Ctrl';
			case 'alt':
				return mac ? '⌥' : 'Alt';
			case 'shift':
				return mac ? '⇧' : 'Shift';
			case 'escape':
			case 'esc':
				return mac ? 'Esc' : 'Escape';
			default:
				// Convert single characters to uppercase
				return part.length === 1 ? part.toUpperCase() : part;
		}
	});

	// Join with no space on Mac, space on other platforms
	return mac ? formatted.join('') : formatted.join('+');
}
