/**
 * Modal state management (SSR-safe using context pattern)
 * Ensures only one modal is open at a time.
 */

import { getContext, setContext } from 'svelte';

type ModalId = 'quickSearch' | 'aiAssistant' | 'shortcuts' | 'sessionExpiry' | null;

const MODALS_CTX = Symbol('modals');

/**
 * Create modal state instance.
 * Modals are mutually exclusive - opening one closes others.
 */
export function createModalState() {
	let activeModal = $state<ModalId>(null);
	let modalData = $state<Record<string, unknown>>({});

	return {
		get active() {
			return activeModal;
		},

		isOpen(id: ModalId) {
			return activeModal === id;
		},

		open(id: ModalId, data?: Record<string, unknown>) {
			activeModal = id;
			if (data) {
				modalData = data;
			}
		},

		close() {
			activeModal = null;
			modalData = {};
		},

		getData<T>(key: string): T | undefined {
			return modalData[key] as T;
		},
	};
}

/**
 * Set modals context in component tree.
 * Call this in root layout.
 */
export function setModalsContext() {
	const modals = createModalState();
	setContext(MODALS_CTX, modals);
	return modals;
}

/**
 * Get modals state from context.
 * Use this in child components.
 */
export function getModals() {
	return getContext<ReturnType<typeof createModalState>>(MODALS_CTX);
}
