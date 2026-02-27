/**
 * Notification state management (SSR-safe using context pattern)
 */

import { getContext, setContext } from 'svelte';

const NOTIFICATION_CTX = Symbol('notifications');

/**
 * Create notification state instance.
 */
export function createNotificationState(initialCount = 0) {
	let unreadCount = $state(initialCount);

	return {
		get unreadCount() {
			return unreadCount;
		},
		setCount(count: number) {
			unreadCount = count;
		},
		increment() {
			unreadCount++;
		},
		decrementBy(n: number) {
			unreadCount = Math.max(0, unreadCount - n);
		},
	};
}

/**
 * Set notification context in component tree.
 * Call this in the app layout.
 */
export function setNotificationContext(initialCount = 0) {
	const state = createNotificationState(initialCount);
	setContext(NOTIFICATION_CTX, state);
	return state;
}

/**
 * Get notification state from context.
 * Use this in child components.
 */
export function getNotifications() {
	return getContext<ReturnType<typeof createNotificationState>>(NOTIFICATION_CTX);
}
