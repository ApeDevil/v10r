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
 * Module-level $state, Map registry, version counter, queueMicrotask. Unlike
 * `panel-menus.svelte.ts`, which is context-scoped precisely so two DockLayouts
 * on one page cannot share a registry, this one is a genuine singleton: the
 * desk route sets `ssr = false` in `src/routes/[[locale=locale]]/desk/+layout.ts`,
 * so the module only ever runs in the browser and state is per-tab.
 */

import {
	budgetAwareSerialize,
	CONTEXT_TOKEN_BUDGET,
	type ContentLevel,
	computeActiveContexts,
	computeContextChips,
	type PanelStatus,
	type SerializedContext,
	type SerializedRequestContext,
} from './desk-context.pure';

// Re-export pure types so existing consumers keep working
export type { ContentLevel, PanelStatus, SerializedContext, SerializedRequestContext };
export { CONTEXT_TOKEN_BUDGET };

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
	/** The desk file the panel shows, so a proposed edit can name its target. */
	fileId?: string;
	fileType?: 'spreadsheet' | 'markdown';
	/** The saved version the panel shows, when the file has one. */
	version?: number;
	/** The panel holds edits the server has not saved yet. */
	dirty?: boolean;
	/**
	 * Bring `content` up to date NOW. Panels debounce their updates; `serializeForRequest`
	 * calls this first, so a turn sent right after an edit carries the edit — not the
	 * snapshot from 800 ms ago.
	 */
	refresh?: () => void;
}

export type ContextStatus = 'implicit' | 'pinned' | 'available';

/** One context entry plus its inclusion status. */
export interface ContextChip {
	context: PanelContext;
	status: ContextStatus;
	/** True if context changed since last AI response */
	stale: boolean;
}

// Module-level state

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

/** When the last request's context was serialized — a change after it is a stale chip. */
let lastRequestAt = $state(0);

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

/**
 * Bare registry version for focus-follower retries. `setContextFocus` no-ops
 * for a panel that has not registered context yet (a just-mounted panel), so
 * the DockLayout follower effect reads this to re-assert focus once the
 * panel's registerPanelContext effect has run.
 */
export function getContextRegistryVersion(): number {
	return registryVersion;
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

/** Dismiss a panel's context — removes it from active inclusion entirely */
export function dismissContext(panelId: string): void {
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

/**
 * All context entries with their status and staleness.
 * Reactive via registryVersion + focusedPanelId + pinnedIds + lastRequestAt.
 * Delegates to pure function for testability.
 */
const contextChips = $derived.by((): ContextChip[] => {
	void registryVersion;
	return computeContextChips(registry, focusedPanelId, pinnedIds, dismissedIds, lastRequestAt);
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

// Public getters (must be called in reactive context)

/** All context entries with status — the bot panel's context section and the chip strip. */
export function getContextChips(): ContextChip[] {
	return contextChips;
}

/**
 * What the NEXT request would carry, as the registry stands: the meter shows the tokens
 * that would be sent and the entries that would be left out — not the registry's total,
 * which the budget and the entry cap never see.
 */
const requestPreview = $derived.by(
	(): SerializedRequestContext => budgetAwareSerialize(activeContexts, focusedPanelId),
);

export function getRequestPreview(): SerializedRequestContext {
	return requestPreview;
}

/**
 * Serialize active contexts for the API request body with budget awareness.
 *
 * Flushes every active panel first (`refresh`), then reads the registry directly rather
 * than the derived list — `updatePanelContext` replaces the entry object synchronously
 * while the version bump that re-derives waits for a microtask. The snapshot time is
 * recorded here, so a chip goes stale the moment its panel changes after Send.
 */
export function serializeForRequest(): SerializedRequestContext {
	for (const ctx of activeContexts) ctx.refresh?.();
	const fresh = computeActiveContexts(registry, focusedPanelId, pinnedIds, dismissedIds);
	lastRequestAt = Date.now();
	return budgetAwareSerialize(fresh, focusedPanelId, CONTEXT_TOKEN_BUDGET);
}
