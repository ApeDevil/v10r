/**
 * Provider preference state for the Desk workspace.
 *
 * Manages which AI provider the user has selected. Follows the same
 * module-level $state pattern as bot-config.svelte.ts.
 *
 * Module-level $state is safe here because the desk route sets `ssr = false`
 * in src/routes/desk/+layout.ts. This module only ever runs in the browser,
 * so state is per-tab and never shared across server requests.
 */

import { apiFetch } from '$lib/api';

// ── Types ───────────────────────────────────────────────────────────

export interface ProviderInfo {
	id: string;
	name: string;
	model: string;
	configured: boolean;
	supportsTools: boolean;
	cooldownUntil: string | null;
}

interface ProviderState {
	providers: ProviderInfo[];
	activeId: string | null;
	preference: string | null;
	loading: boolean;
	error: string | null;
}

// ── Module-level state ──────────────────────────────────────────────

const state = $state<ProviderState>({
	providers: [],
	activeId: null,
	preference: null,
	loading: false,
	error: null,
});

// ── Public API ──────────────────────────────────────────────────────

/** Get the full reactive provider state. */
export function getProviderState(): ProviderState {
	return state;
}

/** Get the active provider ID (for including in chat requests). */
export function getActiveProviderId(): string | null {
	return state.activeId;
}

/** Fetch providers from the server. Call on dialog open. */
export async function fetchProviders(): Promise<void> {
	state.loading = true;
	state.error = null;
	try {
		const res = await apiFetch('/api/ai/providers');
		if (!res.ok) throw new Error('Failed to fetch providers');
		const { data } = await res.json();
		state.providers = data.providers;
		state.activeId = data.activeId;
		state.preference = data.preference;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to fetch providers';
	} finally {
		state.loading = false;
	}
}

/** Switch to a different provider. Pass null to clear preference (use server default). */
export async function switchProvider(providerId: string | null): Promise<boolean> {
	state.loading = true;
	state.error = null;
	try {
		const res = await apiFetch('/api/ai/providers/switch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ providerId }),
		});
		if (!res.ok) {
			const { error } = await res.json();
			state.error = error?.message ?? 'Failed to switch provider';
			return false;
		}
		const { data } = await res.json();
		state.activeId = data.activeId;
		state.preference = providerId;
		return true;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to switch provider';
		return false;
	} finally {
		state.loading = false;
	}
}
