/**
 * Toast notification state management (SSR-safe using context pattern)
 */

import { getContext, setContext } from 'svelte';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration?: number; // Auto-dismiss after N ms (default: 5000)
}

const TOAST_CTX = Symbol('toast');

let toastIdCounter = 0;

/**
 * Create toast state instance.
 */
export function createToastState() {
	// Use SvelteMap for reactive collection
	let toasts = $state<Map<string, Toast>>(new Map());

	return {
		get toasts() {
			return Array.from(toasts.values());
		},

		/**
		 * Add a new toast notification.
		 */
		add(type: ToastType, message: string, duration = 5000) {
			const id = `toast-${++toastIdCounter}`;
			const toast: Toast = { id, type, message, duration };

			toasts.set(id, toast);

			// Auto-dismiss after duration
			if (duration > 0) {
				setTimeout(() => {
					this.remove(id);
				}, duration);
			}

			return id;
		},

		/**
		 * Remove a toast by ID.
		 */
		remove(id: string) {
			toasts.delete(id);
		},

		/**
		 * Clear all toasts.
		 */
		clear() {
			toasts.clear();
		},

		// Convenience methods
		success(message: string, duration?: number) {
			return this.add('success', message, duration);
		},

		error(message: string, duration?: number) {
			return this.add('error', message, duration);
		},

		warning(message: string, duration?: number) {
			return this.add('warning', message, duration);
		},

		info(message: string, duration?: number) {
			return this.add('info', message, duration);
		},
	};
}

/**
 * Set toast context in component tree.
 * Call this in root layout.
 */
export function setToastContext() {
	const toast = createToastState();
	setContext(TOAST_CTX, toast);
	return toast;
}

/**
 * Get toast state from context.
 * Use this in child components.
 */
export function getToast() {
	return getContext<ReturnType<typeof createToastState>>(TOAST_CTX);
}
