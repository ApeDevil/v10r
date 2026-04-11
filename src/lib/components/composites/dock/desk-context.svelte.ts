/**
 * AI context registry for the Desk workspace.
 *
 * Panels register their AI-visible context via $effect on mount.
 * The ChatPanel reads aggregated context for prompt injection.
 *
 * Two-tier model:
 *   - Implicit: the focused panel's context is auto-included
 *   - Pinned: user explicitly pins other panels' context
 *
 * Follows the exact same pattern as panel-menus.svelte.ts:
 * module-level $state, Map registry, version counter, queueMicrotask.
 *
 * Module-level $state is safe here because the desk route sets `ssr = false`
 * in src/routes/(desk)/+layout.ts. This module only ever runs in the browser,
 * so state is per-tab and never shared across server requests.
 */

import {
	budgetAwareSerialize,
	computeActiveContexts,
	computeContextChips,
	CONTEXT_TOKEN_BUDGET,
	type ContentLevel,
	type PanelStatus,
	type SerializedContext,
} from './desk-context.pure';

// Re-export pure types so existing consumers keep working
export type { ContentLevel, PanelStatus, SerializedContext };
export { CONTEXT_TOKEN_BUDGET };

// ── Types ────────────────────────────────────────────────────────────

/** What a panel publishes as its AI-visible state */
export interface PanelContext {
	panelId: string;
	panelType: string;
	label: string;
	/** Markdown/plain-text serialization of panel state for LLM consumption */
	content: string;
	/** Approximate token count (content.length / 4) */
	tokenEstimate: number;
	/** When this context was last updated */
	updatedAt: number;
	/** Content type hint for viewer rendering in Bot Manager */
	contentType?: 'structured' | 'code' | 'plaintext';
}

export type ContextStatus = 'implicit' | 'pinned' | 'available';

/** What the ContextTray renders per entry */
export interface ContextChip {
	context: PanelContext;
	status: ContextStatus;
	/** True if context changed since last AI response */
	stale: boolean;
}

// ── Module-level state ───────────────────────────────────────────────

/** Reactive registry version — bumped on every register/unregister/update */
let registryVersion = $state(0);

/** Non-reactive storage for panel contexts */
const registry = new Map<string, PanelContext>();

/** Which panels the user has explicitly pinned */
let pinnedIds = $state(new Set<string>());

/** Which panels the user has explicitly dismissed (excluded from implicit focus) */
let dismissedIds = $state(new Set<string>());

/** The currently focused panel — drives implicit context */
let focusedPanelId = $state<string | null>(null);

/** Timestamp of the last AI response — drives staleness detection */
let lastResponseAt = $state(0);

// ── Microtask coalescing ─────────────────────────────────────────────

/**
 * Coalesce multiple registry mutations within the same microtask into
 * a single registryVersion bump. Prevents N simultaneous panel
 * registrations from triggering N re-derivations.
 */
let versionBumpPending = false;

function scheduleVersionBump(): void {
	if (versionBumpPending) return;
	versionBumpPending = true;
	queueMicrotask(() => {
		versionBumpPending = false;
		registryVersion++;
	});
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Register context for a panel. Call inside a $effect so it re-runs
 * when panel state changes. Returns a cleanup function.
 *
 * Uses queueMicrotask to defer the version bump so we don't write
 * $state during effect execution (which would cause infinite loops).
 */
export function registerPanelContext(entry: PanelContext): () => void {
	registry.set(entry.panelId, entry);
	queueMicrotask(() => {
		// Auto-focus the first context provider if nothing is focused
		if (focusedPanelId === null) {
			focusedPanelId = entry.panelId;
		}
	});
	scheduleVersionBump();
	return () => {
		registry.delete(entry.panelId);
		pinnedIds.delete(entry.panelId);
		dismissedIds.delete(entry.panelId);
		scheduleVersionBump();
	};
}

/**
 * Update an existing panel's context without re-registering.
 * No-op if panelId is not registered.
 */
export function updatePanelContext(panelId: string, partial: Partial<Omit<PanelContext, 'panelId'>>): void {
	const existing = registry.get(panelId);
	if (!existing) return;
	registry.set(panelId, { ...existing, ...partial, updatedAt: Date.now() });
	scheduleVersionBump();
}

/**
 * Set which panel is currently focused (called by DockLeaf on focusin).
 * Only panels that have registered context are eligible for implicit focus.
 * This prevents context consumers (e.g. ChatPanel) from displacing
 * context providers (e.g. SpreadsheetPanel) when clicked.
 */
export function setContextFocus(panelId: string | null): void {
	if (focusedPanelId === panelId) return;
	if (panelId !== null && !registry.has(panelId)) return;
	focusedPanelId = panelId;
}

/** Pin a panel's context for inclusion in AI prompts across focus switches */
export function pinContext(panelId: string): void {
	if (!registry.has(panelId)) return;
	pinnedIds = new Set([...pinnedIds, panelId]);
	// Clear dismissed state — explicit pin overrides dismiss
	if (dismissedIds.has(panelId)) {
		const next = new Set(dismissedIds);
		next.delete(panelId);
		dismissedIds = next;
	}
}

/** Unpin a panel's context */
export function unpinContext(panelId: string): void {
	const next = new Set(pinnedIds);
	next.delete(panelId);
	pinnedIds = next;
}

/** Dismiss a panel's context — removes it from active inclusion entirely */
export function dismissContext(panelId: string): void {
	// Remove from pinned
	if (pinnedIds.has(panelId)) {
		const nextPinned = new Set(pinnedIds);
		nextPinned.delete(panelId);
		pinnedIds = nextPinned;
	}
	// Add to dismissed so implicit focus won't re-include it
	dismissedIds = new Set([...dismissedIds, panelId]);
}

/** Restore a dismissed panel to natural state (implicit-eligible, not pinned) */
export function restoreContext(panelId: string): void {
	if (!dismissedIds.has(panelId)) return;
	const next = new Set(dismissedIds);
	next.delete(panelId);
	dismissedIds = next;
}

/** Toggle pin state for a panel */
export function togglePin(panelId: string): void {
	if (pinnedIds.has(panelId)) {
		unpinContext(panelId);
	} else {
		pinContext(panelId);
	}
}

/** Record when the last AI response was received (resets staleness) */
export function markResponseReceived(): void {
	lastResponseAt = Date.now();
}

// ── Reactive derived ─────────────────────────────────────────────────

/**
 * All context entries with their status and staleness.
 * Reactive via registryVersion + focusedPanelId + pinnedIds + lastResponseAt.
 * Delegates to pure function for testability.
 */
const contextChips = $derived.by((): ContextChip[] => {
	void registryVersion;
	return computeContextChips(registry, focusedPanelId, pinnedIds, dismissedIds, lastResponseAt);
});

/**
 * Active contexts only (implicit + pinned) — what gets sent to AI.
 * Delegates to pure function for testability.
 */
const activeContexts = $derived.by((): PanelContext[] => {
	void registryVersion;
	return computeActiveContexts(registry, focusedPanelId, pinnedIds, dismissedIds);
});

/** Total estimated tokens across all active (implicit + pinned) entries */
const tokenEstimate = $derived(activeContexts.reduce((sum, c) => sum + c.tokenEstimate, 0));

// ── Public getters (must be called in reactive context) ──────────────

/** Get all context entries with status — for ContextTray rendering */
export function getContextChips(): ContextChip[] {
	return contextChips;
}

/** Get only active contexts (implicit + pinned) — for AI request assembly */
export function getActiveContexts(): PanelContext[] {
	return activeContexts;
}

/** Get total estimated tokens across active contexts */
export function getTokenEstimate(): number {
	return tokenEstimate;
}

/** Serialize active contexts for the API request body with budget awareness */
export function serializeForRequest(): SerializedContext[] {
	return budgetAwareSerialize(activeContexts, focusedPanelId, CONTEXT_TOKEN_BUDGET);
}

/** Check if any context is registered */
export function hasContext(): boolean {
	void registryVersion;
	return registry.size > 0;
}
