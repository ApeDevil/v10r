/**
 * Keyboard event handler for shortcuts.
 * Handles single key combos and sequences.
 */

import { browser } from '$app/environment';
import { findShortcutByKeys } from './registry';
import { isMac } from './platform';

// Sequence state
let sequenceKeys: string[] = [];
let sequenceTimeout: ReturnType<typeof setTimeout> | null = null;
const SEQUENCE_TIMEOUT_MS = 500;

/**
 * Initialize keyboard event handler.
 * Sets up global keydown listener and returns cleanup function.
 */
export function initKeyboardHandler(): () => void {
	if (!browser) return () => {};

	const handleKeydown = (event: KeyboardEvent) => {
		// Ignore if focused on input/textarea/contenteditable
		if (shouldIgnoreEvent(event)) return;

		// Build key string from event
		const keyString = buildKeyString(event);
		if (!keyString) return;

		// Handle sequences (e.g., 'g h')
		if (isSequenceStart(keyString)) {
			handleSequence(keyString, event);
			return;
		}

		// Try to match single combo (e.g., 'mod+k')
		const shortcut = findShortcutByKeys(keyString);
		if (shortcut) {
			event.preventDefault();
			shortcut.action();
		}
	};

	// Attach listener
	window.addEventListener('keydown', handleKeydown);

	// Return cleanup function
	return () => {
		window.removeEventListener('keydown', handleKeydown);
		if (sequenceTimeout) clearTimeout(sequenceTimeout);
	};
}

/**
 * Check if event target is an input element.
 */
function shouldIgnoreEvent(event: KeyboardEvent): boolean {
	const target = event.target as HTMLElement;
	const tagName = target.tagName.toLowerCase();

	// Ignore inputs, textareas, and contenteditable
	if (tagName === 'input' || tagName === 'textarea') return true;
	if (target.isContentEditable) return true;

	// Allow Escape key even in inputs (to close modals)
	if (event.key === 'Escape') return false;

	return false;
}

/**
 * Build key string from keyboard event.
 * Examples: 'mod+k', 'shift+/', 'escape', 'g'
 */
function buildKeyString(event: KeyboardEvent): string | null {
	const parts: string[] = [];
	const mac = isMac();

	// Modifiers (normalize Cmd/Ctrl to 'mod')
	if (event.metaKey && mac) parts.push('mod');
	if (event.ctrlKey && !mac) parts.push('mod');
	if (event.altKey) parts.push('alt');
	if (event.shiftKey && !isSingleShiftKey(event)) parts.push('shift');

	// Main key
	const key = event.key.toLowerCase();

	// Handle special keys
	if (key === 'escape') return 'escape';

	// Handle printable characters
	if (key.length === 1) {
		parts.push(key);
		return parts.join('+');
	}

	// Ignore other special keys (Tab, Arrow keys, etc.)
	return null;
}

/**
 * Check if only Shift was pressed (no other key).
 */
function isSingleShiftKey(event: KeyboardEvent): boolean {
	return event.key === 'Shift' && !event.metaKey && !event.ctrlKey && !event.altKey;
}

/**
 * Check if key could start a sequence (single letter, no modifiers).
 */
function isSequenceStart(keyString: string): boolean {
	// Only single letters with no modifiers can start sequences
	return /^[a-z]$/.test(keyString);
}

/**
 * Handle key sequences (e.g., 'g h').
 */
function handleSequence(keyString: string, event: KeyboardEvent) {
	// Add key to sequence
	sequenceKeys.push(keyString);

	// Clear existing timeout
	if (sequenceTimeout) clearTimeout(sequenceTimeout);

	// Try to match current sequence
	const sequenceString = sequenceKeys.join(' ');
	const shortcut = findShortcutByKeys(sequenceString);

	if (shortcut) {
		// Match found - execute and reset
		event.preventDefault();
		shortcut.action();
		resetSequence();
		return;
	}

	// No match yet - set timeout to reset sequence
	sequenceTimeout = setTimeout(() => {
		resetSequence();
	}, SEQUENCE_TIMEOUT_MS);
}

/**
 * Reset sequence state.
 */
function resetSequence() {
	sequenceKeys = [];
	if (sequenceTimeout) {
		clearTimeout(sequenceTimeout);
		sequenceTimeout = null;
	}
}
