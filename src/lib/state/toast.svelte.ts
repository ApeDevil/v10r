/**
 * Toast notification state management (SSR-safe using context pattern)
 */

import { getContext, setContext } from 'svelte';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration: number;
}

const TOAST_CTX = Symbol('toast');

/**
 * Create toast state instance.
 */
export function createToastState() {
	let toasts = $state<Toast[]>([]);

	function add(type: ToastType, message: string, duration = 5000) {
		const id = crypto.randomUUID();
		toasts.push({ id, type, message, duration });

		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}
	}

	function remove(id: string) {
		toasts = toasts.filter((t) => t.id !== id);
	}

	return {
		get items() {
			return toasts;
		},
		success: (msg: string, duration?: number) => add('success', msg, duration),
		error: (msg: string, duration?: number) => add('error', msg, duration),
		warning: (msg: string, duration?: number) => add('warning', msg, duration),
		info: (msg: string, duration?: number) => add('info', msg, duration),
		remove,
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
