/**
 * Pure functions for desk context computation.
 *
 * Zero $state/$derived — all functions are plain TypeScript, fully testable
 * with Vitest. The reactive layer in desk-context.svelte.ts delegates to these.
 */

import { CONTEXT_ENTRY_MAX_CHARS, CONTEXT_MAX_ENTRIES, CONTEXT_TOKEN_BUDGET } from '$lib/types/desk-context-limits';
import type { ContextChip, ContextStatus, PanelContext } from './desk-context.state.svelte';

export { CONTEXT_TOKEN_BUDGET };

/** How much content is included in the AI prompt for a panel. */
export type ContentLevel = 'full' | 'summary' | 'title-only';

/** Panel status relative to the desk — drives content level and AI awareness. */
export type PanelStatus = 'focused' | 'active' | 'background';

/**
 * What gets sent to the server in the request body: the content the model reads plus the
 * IDENTITY of what it describes — which panel, which file, at which version, saved or not —
 * so an edit the bot proposes can name its target, and the label the entry carries is
 * true of the text that was actually sent (`truncated` when it was cut to the entry cap).
 */
export interface SerializedContext {
	panelId: string;
	panelType: string;
	label: string;
	content: string;
	status: PanelStatus;
	contentLevel: ContentLevel;
	tokenEstimate: number;
	truncated: boolean;
	fileId?: string;
	fileType?: 'spreadsheet' | 'markdown';
	/** The saved version the panel shows, when the file has one. */
	version?: number;
	/** The panel holds edits the server has not saved yet. */
	dirty?: boolean;
}

/** An active context that did NOT go into the request, and why — shown, never silent. */
export interface ContextOmission {
	panelId: string;
	label: string;
	reason: 'entry_cap' | 'budget';
}

export interface SerializedRequestContext {
	entries: SerializedContext[];
	omitted: ContextOmission[];
	/** What the meter shows: the tokens actually sent, not the registry's total. */
	tokensSent: number;
}

/** Budget thresholds — fractions of CONTEXT_TOKEN_BUDGET. */
const COMPACT_THRESHOLD = 0.7;
const TITLE_ONLY_THRESHOLD = 0.9;

/** Max chars for a summary-level truncation. */
const SUMMARY_MAX_CHARS = 500;

/** Approximate token count from content length. */
export function estimateTokens(content: string): number {
	return Math.ceil(content.length / 4);
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
	lastRequestAt: number,
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

		// Stale = changed since the snapshot the last request was serialized from — a panel that
		// changed while the answer streamed is stale too, whatever the answer's timing.
		const stale = status !== 'available' && lastRequestAt > 0 && context.updatedAt > lastRequestAt;

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
	const summary = `${content.slice(0, SUMMARY_MAX_CHARS)}\n[truncated]`;
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
 * Always includes the focused panel (at least at title-only). Enforces the request's own
 * limits — at most `CONTEXT_MAX_ENTRIES` entries, each at most `CONTEXT_ENTRY_MAX_CHARS` —
 * and reports what it left out, so the meter and the log can say so instead of the route
 * refusing the whole turn.
 */
export function budgetAwareSerialize(
	activeContexts: PanelContext[],
	focusedPanelId: string | null,
	budget: number = CONTEXT_TOKEN_BUDGET,
): SerializedRequestContext {
	if (activeContexts.length === 0) return { entries: [], omitted: [], tokensSent: 0 };

	// Sort: focused first, then by tokenEstimate ascending (pack smaller panels first)
	const sorted = [...activeContexts].sort((a, b) => {
		if (a.panelId === focusedPanelId) return -1;
		if (b.panelId === focusedPanelId) return 1;
		return a.tokenEstimate - b.tokenEstimate;
	});

	let tokensUsed = 0;
	const entries: SerializedContext[] = [];
	const omitted: ContextOmission[] = [];

	for (const ctx of sorted) {
		const usageFraction = tokensUsed / budget;
		const remaining = budget - tokensUsed;
		const isFocused = ctx.panelId === focusedPanelId;

		if (entries.length >= CONTEXT_MAX_ENTRIES) {
			omitted.push({ panelId: ctx.panelId, label: ctx.label, reason: 'entry_cap' });
			continue;
		}
		if (remaining <= 0 && !isFocused) {
			// Budget exhausted, skip non-focused panels
			omitted.push({ panelId: ctx.panelId, label: ctx.label, reason: 'budget' });
			continue;
		}

		let text: string;
		let level: ContentLevel;

		if (usageFraction >= TITLE_ONLY_THRESHOLD && !isFocused) {
			// Over 90% — title-only for non-focused
			text = truncateToTokenBudget(ctx.content, ctx.label, 0).text;
			level = 'title-only';
		} else if (usageFraction >= COMPACT_THRESHOLD || ctx.tokenEstimate > remaining) {
			// Over 70%, or content exceeds what is left — summary, then title-only
			const truncated = truncateToTokenBudget(ctx.content, ctx.label, remaining);
			text = truncated.text;
			level = truncated.level;
		} else {
			text = ctx.content;
			level = 'full';
		}

		// The entry cap the route enforces — applied here so the label stays honest.
		let truncated = level !== 'full';
		if (text.length > CONTEXT_ENTRY_MAX_CHARS) {
			text = `${text.slice(0, CONTEXT_ENTRY_MAX_CHARS - 12)}\n[truncated]`;
			if (level === 'full') level = 'summary';
			truncated = true;
		}

		const tokens = estimateTokens(text);
		tokensUsed += tokens;

		entries.push({
			panelId: ctx.panelId,
			panelType: ctx.panelType,
			label: ctx.label,
			content: text,
			status: isFocused ? 'focused' : 'active',
			contentLevel: level,
			tokenEstimate: tokens,
			truncated,
			...(ctx.fileId ? { fileId: ctx.fileId } : {}),
			...(ctx.fileType ? { fileType: ctx.fileType } : {}),
			...(ctx.version !== undefined ? { version: ctx.version } : {}),
			...(ctx.dirty !== undefined ? { dirty: ctx.dirty } : {}),
		});
	}

	return { entries, omitted, tokensSent: tokensUsed };
}
