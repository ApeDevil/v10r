/**
 * Toast notification state management (SSR-safe using context pattern)
 */

import { getContext, setContext } from 'svelte';

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
	label: string;
	onclick: () => void;
}

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration: number;
	action?: ToastAction;
}

export interface ToastOptions {
	type?: ToastType;
	message: string;
	/** 0 = persistent until dismissed. */
	duration?: number;
	action?: ToastAction;
}

const TOAST_CTX = Symbol('toast');

/**
 * Create toast state instance.
 */
export function createToastState() {
	let toasts = $state<Toast[]>([]);

	function add(type: ToastType, message: string, duration = 5000, action?: ToastAction) {
		const id = crypto.randomUUID();
		toasts.push({ id, type, message, duration, action });

		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}

		return id;
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
		/** Full-control variant — supports persistent toasts with an action button. */
		show: ({ type = 'info', message, duration = 5000, action }: ToastOptions) => add(type, message, duration, action),
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
