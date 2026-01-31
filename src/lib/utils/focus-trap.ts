/**
 * Focus trap utility for modals and drawers.
 * Traps keyboard focus within a container element.
 */

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus within a container element.
 * @param container - Element to trap focus within
 * @returns Cleanup function to remove the trap
 */
export function trapFocus(container: HTMLElement): () => void {
	const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
	const firstFocusable = focusableElements[0];
	const lastFocusable = focusableElements[focusableElements.length - 1];

	// Focus first element on mount
	firstFocusable?.focus();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		if (e.shiftKey && document.activeElement === firstFocusable) {
			// Shift+Tab on first element -> focus last
			e.preventDefault();
			lastFocusable?.focus();
		} else if (!e.shiftKey && document.activeElement === lastFocusable) {
			// Tab on last element -> focus first
			e.preventDefault();
			firstFocusable?.focus();
		}
	}

	container.addEventListener('keydown', handleKeydown);

	return () => {
		container.removeEventListener('keydown', handleKeydown);
	};
}
