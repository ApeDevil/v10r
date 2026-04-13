/**
 * Bot configuration state for the Desk workspace.
 *
 * Exposes two *user-visible* toggles — "Allow editing existing files"
 * (`desk:write`) and "Allow deleting files" (`desk:delete`). Read and
 * create scopes are always-on: they're safe because delete is soft and
 * create's undo path is "delete the file you just created."
 *
 * Per-action gating lives in the PlanCard / ConfirmCard components, not
 * here. The old 12-second revert timer was removed because plan-before-
 * execute moves consent to *before* the action, not after — a countdown
 * to stop something that already happened is the wrong posture.
 *
 * Module-level $state is safe because the desk route sets `ssr = false`
 * in src/routes/(desk)/+layout.ts. This module only ever runs in the
 * browser, so state is per-tab and never shared across server requests.
 */

import type { DeskToolScope } from '$lib/server/ai/tools/_types';

// ── Module-level state ───────────────────────────────────────────────

/**
 * Scopes the user has explicitly opted into.
 *
 * Read and create are ALWAYS granted when any scope is present — they
 * never appear in this set and can't be toggled off. Write and delete
 * are the only user-facing toggles.
 */
let optInScopes = $state(new Set<Exclude<DeskToolScope, 'desk:read' | 'desk:create'>>());

// ── Derived ──────────────────────────────────────────────────────────

/**
 * The full scope set to send in requests — always includes read+create,
 * plus whichever mutating scopes the user opted into.
 */
const effectiveScopes = $derived<DeskToolScope[]>(['desk:read', 'desk:create', ...[...optInScopes]]);

const hasWriteCapabilities = $derived(optInScopes.has('desk:write') || optInScopes.has('desk:delete'));

// ── Public API ───────────────────────────────────────────────────────

/** Get enabled scopes as an array for request serialization. */
export function getEnabledScopes(): DeskToolScope[] {
	return effectiveScopes;
}

/**
 * Check if a specific scope is enabled.
 *
 * `desk:read` and `desk:create` are always enabled whenever any scope
 * is available, so they return `true` unconditionally.
 */
export function isScopeEnabled(scope: DeskToolScope): boolean {
	void effectiveScopes; // establish reactive dependency
	if (scope === 'desk:read' || scope === 'desk:create') return true;
	return optInScopes.has(scope);
}

/** Check if any write/delete capabilities are enabled. */
export function hasWriteAccess(): boolean {
	return hasWriteCapabilities;
}

/**
 * Enable a user-toggleable scope. Read and create are always-on and
 * calling `enableScope('desk:read')` is a no-op.
 */
export function enableScope(scope: DeskToolScope): void {
	if (scope === 'desk:read' || scope === 'desk:create') return;
	if (optInScopes.has(scope)) return;
	optInScopes = new Set([...optInScopes, scope]);
}

/** Disable a user-toggleable scope. */
export function disableScope(scope: DeskToolScope): void {
	if (scope === 'desk:read' || scope === 'desk:create') return;
	if (!optInScopes.has(scope)) return;
	const next = new Set(optInScopes);
	next.delete(scope);
	optInScopes = next;
}

/** Toggle a user-toggleable scope on/off. */
export function toggleScope(scope: DeskToolScope): void {
	if (scope === 'desk:read' || scope === 'desk:create') return;
	if (optInScopes.has(scope)) {
		disableScope(scope);
	} else {
		enableScope(scope);
	}
}
