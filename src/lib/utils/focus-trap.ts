/**
 * Focus trap utility for modals and drawers.
 * Traps keyboard focus within a container element.
 */

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus within a container element.
 * Stores the previously focused element and restores focus on cleanup.
 * @param container - Element to trap focus within
 * @returns Cleanup function to remove the trap and restore focus
 */
export function trapFocus(container: HTMLElement): () => void {
	// Store the element that had focus before the trap
	const previouslyFocused = document.activeElement as HTMLElement | null;

	const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

	// Focus first element on mount
	focusableElements[0]?.focus();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		// Re-query focusable elements in case DOM changed
		const currentFocusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
		const first = currentFocusable[0];
		const last = currentFocusable[currentFocusable.length - 1];

		if (e.shiftKey && document.activeElement === first) {
			// Shift+Tab on first element -> focus last
			e.preventDefault();
			last?.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			// Tab on last element -> focus first
			e.preventDefault();
			first?.focus();
		}
	}

	container.addEventListener('keydown', handleKeydown);

	return () => {
		container.removeEventListener('keydown', handleKeydown);
		// Restore focus to the element that had focus before the trap
		previouslyFocused?.focus();
	};
}
