/**
 * Conversation storage state for the Desk workspace.
 *
 * Manages the conversation list and stats for the Storage tab
 * in the Bot Manager dialog. Follows the same module-level $state
 * pattern as bot-config.svelte.ts and provider-preference.svelte.ts.
 *
 * Module-level $state is safe here because the desk route sets `ssr = false`
 * in src/routes/(desk)/+layout.ts.
 */

import { apiFetch } from '$lib/api';

// ── Types ───────────────────────────────────────────────────────────

export interface ConversationSummary {
	id: string;
	title: string | null;
	totalTokens: number;
	createdAt: string;
	updatedAt: string;
}

export interface StorageMeta {
	total: number;
	totalTokens: number;
	limit: number;
	usagePercent: number;
}

interface StorageState {
	conversations: ConversationSummary[];
	meta: StorageMeta | null;
	loading: boolean;
	deleting: Set<string>;
	error: string | null;
}

// ── Module-level state ──────────────────────────────────────────────

const state = $state<StorageState>({
	conversations: [],
	meta: null,
	loading: false,
	deleting: new Set(),
	error: null,
});

// ── Public API ──────────────────────────────────────────────────────

/** Get the reactive storage state. */
export function getStorageState(): StorageState {
	return state;
}

/** Fetch conversations + stats from the server. Sorted oldest first for deletion UX. */
export async function fetchConversationStorage(): Promise<void> {
	state.loading = true;
	state.error = null;
	try {
		const res = await apiFetch('/api/ai/conversations?sort=oldest');
		if (!res.ok) throw new Error('Failed to fetch conversations');
		const { data } = await res.json();
		state.conversations = data.items;
		state.meta = data.meta;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to fetch conversations';
	} finally {
		state.loading = false;
	}
}

/** Delete a single conversation. Optimistic — dims row, removes on success, rolls back on error. */
export async function deleteSingleConversation(id: string): Promise<boolean> {
	const snapshot = [...state.conversations];
	state.deleting = new Set([...state.deleting, id]);

	try {
		const res = await apiFetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			state.error = 'Delete failed';
			return false;
		}
		// Success — remove from list and update meta
		state.conversations = state.conversations.filter((c) => c.id !== id);
		if (state.meta) {
			state.meta = {
				...state.meta,
				total: state.meta.total - 1,
				usagePercent: Math.round(((state.meta.total - 1) / state.meta.limit) * 100),
			};
		}
		return true;
	} catch {
		state.conversations = snapshot;
		state.error = 'Delete failed';
		return false;
	} finally {
		const next = new Set(state.deleting);
		next.delete(id);
		state.deleting = next;
	}
}

/** Bulk delete conversations by IDs. Returns true on success. */
export async function deleteConversations(ids: string[]): Promise<boolean> {
	if (ids.length === 0) return true;
	const snapshot = [...state.conversations];
	const idSet = new Set(ids);

	// Optimistic: mark as deleting
	state.deleting = new Set([...state.deleting, ...ids]);

	try {
		const res = await apiFetch('/api/ai/conversations/bulk-delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids }),
		});
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: null }));
			state.error = error?.message ?? 'Bulk delete failed';
			return false;
		}
		const { data } = await res.json();
		// Remove deleted conversations and update meta from server response
		state.conversations = state.conversations.filter((c) => !idSet.has(c.id));
		if (data.meta) state.meta = data.meta;
		return true;
	} catch {
		state.conversations = snapshot;
		state.error = 'Bulk delete failed';
		return false;
	} finally {
		const next = new Set(state.deleting);
		for (const id of ids) next.delete(id);
		state.deleting = next;
	}
}

/** Reset storage state (e.g., for re-fetch after dialog reopen). */
export function resetStorageState(): void {
	state.conversations = [];
	state.meta = null;
	state.error = null;
}
