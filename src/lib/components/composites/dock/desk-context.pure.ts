/**
 * Pure functions for desk context computation.
 *
 * Zero $state/$derived — all functions are plain TypeScript, fully testable
 * with Vitest. The reactive layer in desk-context.svelte.ts delegates to these.
 */

import type { ContextChip, ContextStatus, PanelContext } from './desk-context.svelte';

// ── Types ────────────────────────────────────────────────────────────

/** How much content is included in the AI prompt for a panel. */
export type ContentLevel = 'full' | 'summary' | 'title-only';

/** Panel status relative to the desk — drives content level and AI awareness. */
export type PanelStatus = 'focused' | 'active' | 'background';

/** What gets sent to the server in the request body (extended with budget metadata). */
export interface SerializedContext {
	panelType: string;
	label: string;
	content: string;
	status: PanelStatus;
	contentLevel: ContentLevel;
	tokenEstimate: number;
}

// ── Constants ────────────────────────────────────────────────────────

/** Max tokens for all panel context combined in a single AI request. */
export const CONTEXT_TOKEN_BUDGET = 8000;

/** Budget thresholds — fractions of CONTEXT_TOKEN_BUDGET. */
const COMPACT_THRESHOLD = 0.7;
const TITLE_ONLY_THRESHOLD = 0.9;

/** Max chars for a summary-level truncation. */
const SUMMARY_MAX_CHARS = 500;

// ── Pure computations ────────────────────────────────────────────────

/** Approximate token count from content length. */
export function estimateTokens(content: string): number {
	return Math.ceil(content.length / 4);
}

/**
 * Compute the context status for a single panel.
 * Mirrors the logic in desk-context.svelte.ts contextChips $derived.
 */
export function computePanelStatus(
	panelId: string,
	focusedPanelId: string | null,
	pinnedIds: Set<string>,
	dismissedIds: Set<string>,
): PanelStatus {
	const isDismissed = dismissedIds.has(panelId);
	if (!isDismissed && focusedPanelId === panelId) return 'focused';
	if (!isDismissed && pinnedIds.has(panelId)) return 'active';
	return 'background';
}

/**
 * Build the full ContextChip[] array from registry state.
 * Extracted from desk-context.svelte.ts:185-212.
 */
export function computeContextChips(
	registry: Map<string, PanelContext>,
	focusedPanelId: string | null,
	pinnedIds: Set<string>,
	dismissedIds: Set<string>,
	lastResponseAt: number,
): ContextChip[] {
	const chips: ContextChip[] = [];

	for (const [panelId, context] of registry) {
		const isDismissed = dismissedIds.has(panelId);
		let status: ContextStatus;
		if (!isDismissed && focusedPanelId === panelId) {
			status = 'implicit';
		} else if (!isDismissed && pinnedIds.has(panelId)) {
			status = 'pinned';
		} else {
			status = 'available';
		}

		const stale = status !== 'available' && lastResponseAt > 0 && context.updatedAt > lastResponseAt;

		chips.push({ context, status, stale });
	}

	// Sort: implicit first, then pinned, then available
	const order: Record<ContextStatus, number> = { implicit: 0, pinned: 1, available: 2 };
	chips.sort((a, b) => order[a.status] - order[b.status]);

	return chips;
}

/**
 * Filter to active contexts only (implicit + pinned, excluding dismissed).
 * Extracted from desk-context.svelte.ts:215-228.
 */
export function computeActiveContexts(
	registry: Map<string, PanelContext>,
	focusedPanelId: string | null,
	pinnedIds: Set<string>,
	dismissedIds: Set<string>,
): PanelContext[] {
	const active: PanelContext[] = [];

	for (const [panelId, context] of registry) {
		if (dismissedIds.has(panelId)) continue;
		if (focusedPanelId === panelId || pinnedIds.has(panelId)) {
			active.push(context);
		}
	}

	return active;
}

/**
 * Truncate content to fit within a token budget, returning the appropriate level.
 */
export function truncateToTokenBudget(
	content: string,
	label: string,
	maxTokens: number,
): { text: string; level: ContentLevel } {
	const fullTokens = estimateTokens(content);

	// Full content fits
	if (fullTokens <= maxTokens) {
		return { text: content, level: 'full' };
	}

	// Try summary: first SUMMARY_MAX_CHARS + truncation marker
	const summary = content.slice(0, SUMMARY_MAX_CHARS) + '\n[truncated]';
	const summaryTokens = estimateTokens(summary);
	if (summaryTokens <= maxTokens) {
		return { text: summary, level: 'summary' };
	}

	// Title-only: just label, no content
	return { text: `[${label}]`, level: 'title-only' };
}

/**
 * Budget-aware serialization of active contexts for the AI request body.
 *
 * Priority ordering: focused first, then pinned by tokenEstimate ascending.
 * Fills budget greedily: full content until 70%, then summary, then title-only.
 * Always includes the focused panel (at least at title-only).
 */
export function budgetAwareSerialize(
	activeContexts: PanelContext[],
	focusedPanelId: string | null,
	budget: number = CONTEXT_TOKEN_BUDGET,
): SerializedContext[] {
	if (activeContexts.length === 0) return [];

	// Sort: focused first, then by tokenEstimate ascending (pack smaller panels first)
	const sorted = [...activeContexts].sort((a, b) => {
		if (a.panelId === focusedPanelId) return -1;
		if (b.panelId === focusedPanelId) return 1;
		return a.tokenEstimate - b.tokenEstimate;
	});

	let tokensUsed = 0;
	const result: SerializedContext[] = [];

	for (const ctx of sorted) {
		const usageFraction = tokensUsed / budget;
		const remaining = budget - tokensUsed;
		const isFocused = ctx.panelId === focusedPanelId;

		let text: string;
		let level: ContentLevel;
		let tokens: number;

		if (remaining <= 0 && !isFocused) {
			// Budget exhausted, skip non-focused panels
			continue;
		}

		if (usageFraction >= TITLE_ONLY_THRESHOLD && !isFocused) {
			// Over 90% — title-only for non-focused
			const truncated = truncateToTokenBudget(ctx.content, ctx.label, 0);
			text = truncated.text;
			level = 'title-only';
			tokens = estimateTokens(text);
		} else if (usageFraction >= COMPACT_THRESHOLD) {
			// Over 70% — try summary first
			const truncated = truncateToTokenBudget(ctx.content, ctx.label, remaining);
			text = truncated.text;
			level = truncated.level;
			tokens = estimateTokens(text);
		} else {
			// Under 70% — try full content
			if (ctx.tokenEstimate <= remaining) {
				text = ctx.content;
				level = 'full';
				tokens = ctx.tokenEstimate;
			} else {
				// Content exceeds remaining — truncate
				const truncated = truncateToTokenBudget(ctx.content, ctx.label, remaining);
				text = truncated.text;
				level = truncated.level;
				tokens = estimateTokens(text);
			}
		}

		tokensUsed += tokens;

		result.push({
			panelType: ctx.panelType,
			label: ctx.label,
			content: text,
			status: isFocused ? 'focused' : 'active',
			contentLevel: level,
			tokenEstimate: tokens,
		});
	}

	return result;
}
