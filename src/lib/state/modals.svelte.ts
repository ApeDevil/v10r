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

		toggle(id: ModalId) {
			activeModal = activeModal === id ? null : id;
		},

		close() {
			activeModal = null;
			modalData = {};
		},

		getData<T>(key: string): T | undefined {
			return modalData[key] as T;
		},

		/** Bindable getter/setter for QuickSearch dialog */
		get quickSearchOpen() {
			return activeModal === 'quickSearch';
		},
		set quickSearchOpen(value: boolean) {
			activeModal = value ? 'quickSearch' : null;
			if (!value) modalData = {};
		},

		/** Bindable getter/setter for AI Assistant dialog */
		get aiAssistantOpen() {
			return activeModal === 'aiAssistant';
		},
		set aiAssistantOpen(value: boolean) {
			activeModal = value ? 'aiAssistant' : null;
			if (!value) modalData = {};
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
