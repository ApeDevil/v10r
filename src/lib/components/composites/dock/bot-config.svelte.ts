/**
 * Bot configuration state for the Desk workspace.
 *
 * Manages AI tool scope permissions that the user can toggle
 * via the Bot Manager Dialog. Follows the same module-level $state
 * pattern as desk-context.svelte.ts.
 *
 * Module-level $state is safe here because the desk route sets `ssr = false`
 * in src/routes/(desk)/+layout.ts. This module only ever runs in the browser,
 * so state is per-tab and never shared across server requests.
 */

import type { DeskToolScope } from '$lib/server/ai/tools/_types';

// ── Module-level state ───────────────────────────────────────────────

/** Tool scopes the user has enabled. Default: read-only (least privilege). */
let enabledScopes = $state(new Set<DeskToolScope>(['desk:read']));

/** Whether the delete scope is pending user confirmation (12s window). */
let deleteConfirmPending = $state(false);

/** Timer for auto-reverting delete enable. Non-reactive — no UI dependency on the timer itself. */
let deleteRevertTimer: ReturnType<typeof setTimeout> | null = null;

// ── Derived ──────────────────────────────────────────────────────────

/** Reactive array of enabled scopes — use in reactive contexts. */
const scopeArray = $derived([...enabledScopes]);

/** Whether any non-read scope is enabled (write, create, or delete). */
const hasWriteCapabilities = $derived(
	enabledScopes.has('desk:write') || enabledScopes.has('desk:create') || enabledScopes.has('desk:delete'),
);

// ── Public API ───────────────────────────────────────────────────────

/** Get enabled scopes as an array for request serialization. */
export function getEnabledScopes(): DeskToolScope[] {
	return scopeArray;
}

/** Check if a specific scope is enabled. */
export function isScopeEnabled(scope: DeskToolScope): boolean {
	void scopeArray; // establish reactive dependency
	return enabledScopes.has(scope);
}

/** Check if any write capabilities are enabled. */
export function hasWriteAccess(): boolean {
	return hasWriteCapabilities;
}

/** Enable a tool scope. For desk:delete, triggers confirmation flow. */
export function enableScope(scope: DeskToolScope): void {
	if (enabledScopes.has(scope)) return;

	if (scope === 'desk:delete') {
		// Don't add immediately — require confirmation
		deleteConfirmPending = true;
		clearDeleteTimer();
		deleteRevertTimer = setTimeout(() => {
			cancelDelete();
		}, 12_000);
		return;
	}

	enabledScopes = new Set([...enabledScopes, scope]);
}

/** Disable a tool scope. */
export function disableScope(scope: DeskToolScope): void {
	if (!enabledScopes.has(scope)) return;

	if (scope === 'desk:delete') {
		clearDeleteTimer();
		deleteConfirmPending = false;
	}

	const next = new Set(enabledScopes);
	next.delete(scope);
	enabledScopes = next;
}

/** Toggle a scope on/off. */
export function toggleScope(scope: DeskToolScope): void {
	if (enabledScopes.has(scope)) {
		disableScope(scope);
	} else {
		enableScope(scope);
	}
}

/** Whether delete confirmation is pending. */
export function isDeletePending(): boolean {
	return deleteConfirmPending;
}

/** Confirm delete scope — actually adds desk:delete to enabled scopes. */
export function confirmDelete(): void {
	clearDeleteTimer();
	deleteConfirmPending = false;
	enabledScopes = new Set([...enabledScopes, 'desk:delete']);
}

/** Cancel pending delete enable. */
export function cancelDelete(): void {
	clearDeleteTimer();
	deleteConfirmPending = false;
}

// ── Internal ─────────────────────────────────────────────────────────

function clearDeleteTimer(): void {
	if (deleteRevertTimer !== null) {
		clearTimeout(deleteRevertTimer);
		deleteRevertTimer = null;
	}
}
