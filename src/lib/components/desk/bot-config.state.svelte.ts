/**
 * Bot configuration state for the Desk workspace.
 *
 * Exposes two *user-visible* toggles — "Allow editing existing files"
 * (`desk:write`) and "Allow deleting files" (`desk:delete`). Read and
 * create scopes are always-on: they're safe because delete is soft and
 * create's undo path is "delete the file you just created."
 *
 * Per-action gating is not here: destructive tools return a `requiresApproval`
 * sentinel that becomes a pending `agent_proposal`, surfaced as a PlanCard and
 * executed only via the approve endpoint. Consent therefore lands *before* the
 * action, which is why there is no revert countdown — a timer to stop something
 * that already happened is the wrong posture.
 *
 * Module-level $state, safe for the reason desk-context.svelte.ts documents.
 */

import type { DeskToolScope } from '$lib/server/ai/tools/_types';

// Module-level state

/**
 * Scopes the user has explicitly opted into.
 *
 * Read and create are ALWAYS granted when any scope is present — they
 * never appear in this set and can't be toggled off. Write and delete
 * are the only user-facing toggles.
 */
let optInScopes = $state(new Set<Exclude<DeskToolScope, 'desk:read' | 'desk:create'>>());

/**
 * The full scope set to send in requests — always includes read+create,
 * plus whichever mutating scopes the user opted into.
 */
const effectiveScopes = $derived<DeskToolScope[]>(['desk:read', 'desk:create', ...[...optInScopes]]);

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
