/**
 * Permission tiers for AI tool execution in the Desk.
 *
 * - read-only: AI can see context but cannot use tools
 * - suggest: AI proposes tool calls, user approves before execution
 * - auto: AI executes tools immediately
 */

// ── Types ────────────────────────────────────────────────────────────

export type PermissionTier = 'read-only' | 'suggest' | 'auto';

// ── Module-level state ───────────────────────────────────────────────

let currentTier = $state<PermissionTier>('suggest');

// ── Public API ───────────────────────────────────────────────────────

export function getPermissionTier(): PermissionTier {
	return currentTier;
}

export function setPermissionTier(tier: PermissionTier): void {
	currentTier = tier;
}
