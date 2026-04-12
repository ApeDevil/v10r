import { describe, expect, it } from 'vitest';
import { makePanelContext, makeRegistry, SAMPLES } from './desk-context.fixtures';
import {
	budgetAwareSerialize,
	CONTEXT_TOKEN_BUDGET,
	computeActiveContexts,
	computeContextChips,
	computePanelStatus,
	estimateTokens,
	truncateToTokenBudget,
} from './desk-context.pure';

// ── estimateTokens ──────────────────────────────────────────────────

describe('estimateTokens', () => {
	it('returns content.length / 4 rounded up', () => {
		expect(estimateTokens('abcd')).toBe(1);
		expect(estimateTokens('abcde')).toBe(2);
		expect(estimateTokens('')).toBe(0);
	});
});

// ── computePanelStatus ──────────────────────────────────────────────

describe('computePanelStatus', () => {
	it('returns focused when panel is focused and not dismissed', () => {
		expect(computePanelStatus('p1', 'p1', new Set(), new Set())).toBe('focused');
	});

	it('returns active when panel is pinned and not dismissed', () => {
		expect(computePanelStatus('p1', 'other', new Set(['p1']), new Set())).toBe('active');
	});

	it('returns background when panel is neither focused nor pinned', () => {
		expect(computePanelStatus('p1', 'other', new Set(), new Set())).toBe('background');
	});

	it('returns background when focused but dismissed', () => {
		expect(computePanelStatus('p1', 'p1', new Set(), new Set(['p1']))).toBe('background');
	});

	it('returns background when pinned but dismissed', () => {
		expect(computePanelStatus('p1', null, new Set(['p1']), new Set(['p1']))).toBe('background');
	});
});

// ── computeContextChips ─────────────────────────────────────────────

describe('computeContextChips', () => {
	it('returns empty array for empty registry', () => {
		const chips = computeContextChips(new Map(), null, new Set(), new Set(), 0);
		expect(chips).toEqual([]);
	});

	it('marks focused panel as implicit', () => {
		const p = SAMPLES.spreadsheet();
		const registry = makeRegistry(p);
		const chips = computeContextChips(registry, p.panelId, new Set(), new Set(), 0);
		expect(chips[0].status).toBe('implicit');
	});

	it('marks pinned panel as pinned', () => {
		const p = SAMPLES.spreadsheet();
		const registry = makeRegistry(p);
		const chips = computeContextChips(registry, null, new Set([p.panelId]), new Set(), 0);
		expect(chips[0].status).toBe('pinned');
	});

	it('marks dismissed panel as available even if focused', () => {
		const p = SAMPLES.spreadsheet();
		const registry = makeRegistry(p);
		const chips = computeContextChips(registry, p.panelId, new Set(), new Set([p.panelId]), 0);
		expect(chips[0].status).toBe('available');
	});

	it('sorts by priority: implicit > pinned > available', () => {
		const a = makePanelContext({ panelId: 'a' });
		const b = makePanelContext({ panelId: 'b' });
		const c = makePanelContext({ panelId: 'c' });
		const registry = makeRegistry(a, b, c);
		const chips = computeContextChips(registry, 'a', new Set(['b']), new Set(), 0);
		expect(chips.map((ch) => ch.status)).toEqual(['implicit', 'pinned', 'available']);
	});

	it('marks stale when context updated after last response', () => {
		const p = makePanelContext({ panelId: 'p1', updatedAt: 200 });
		const registry = makeRegistry(p);
		const chips = computeContextChips(registry, 'p1', new Set(), new Set(), 100);
		expect(chips[0].stale).toBe(true);
	});

	it('marks not stale when context updated before last response', () => {
		const p = makePanelContext({ panelId: 'p1', updatedAt: 50 });
		const registry = makeRegistry(p);
		const chips = computeContextChips(registry, 'p1', new Set(), new Set(), 100);
		expect(chips[0].stale).toBe(false);
	});

	it('available panels are never stale', () => {
		const p = makePanelContext({ panelId: 'p1', updatedAt: 200 });
		const registry = makeRegistry(p);
		const chips = computeContextChips(registry, null, new Set(), new Set(), 100);
		expect(chips[0].status).toBe('available');
		expect(chips[0].stale).toBe(false);
	});
});

// ── computeActiveContexts ───────────────────────────────────────────

describe('computeActiveContexts', () => {
	it('returns empty for empty registry', () => {
		expect(computeActiveContexts(new Map(), null, new Set(), new Set())).toEqual([]);
	});

	it('includes focused panel', () => {
		const p = SAMPLES.spreadsheet();
		const registry = makeRegistry(p);
		const active = computeActiveContexts(registry, p.panelId, new Set(), new Set());
		expect(active).toHaveLength(1);
		expect(active[0].panelId).toBe(p.panelId);
	});

	it('includes pinned panel', () => {
		const p = SAMPLES.markdown();
		const registry = makeRegistry(p);
		const active = computeActiveContexts(registry, null, new Set([p.panelId]), new Set());
		expect(active).toHaveLength(1);
	});

	it('excludes dismissed panel even if focused', () => {
		const p = SAMPLES.spreadsheet();
		const registry = makeRegistry(p);
		const active = computeActiveContexts(registry, p.panelId, new Set(), new Set([p.panelId]));
		expect(active).toHaveLength(0);
	});

	it('excludes available (non-focused, non-pinned) panels', () => {
		const a = SAMPLES.spreadsheet();
		const b = SAMPLES.explorer();
		const registry = makeRegistry(a, b);
		const active = computeActiveContexts(registry, a.panelId, new Set(), new Set());
		expect(active).toHaveLength(1);
		expect(active[0].panelId).toBe(a.panelId);
	});
});

// ── truncateToTokenBudget ───────────────────────────────────────────

describe('truncateToTokenBudget', () => {
	it('returns full when content fits', () => {
		const result = truncateToTokenBudget('short', 'Test', 100);
		expect(result.level).toBe('full');
		expect(result.text).toBe('short');
	});

	it('returns summary when content exceeds budget but summary fits', () => {
		const longContent = 'x'.repeat(2000);
		const result = truncateToTokenBudget(longContent, 'Test', 200);
		expect(result.level).toBe('summary');
		expect(result.text).toContain('[truncated]');
		expect(result.text.length).toBeLessThan(longContent.length);
	});

	it('returns title-only when even summary exceeds budget', () => {
		const longContent = 'x'.repeat(2000);
		const result = truncateToTokenBudget(longContent, 'My Panel', 5);
		expect(result.level).toBe('title-only');
		expect(result.text).toBe('[My Panel]');
	});
});

// ── budgetAwareSerialize ────────────────────────────────────────────

describe('budgetAwareSerialize', () => {
	it('returns empty array for empty input', () => {
		expect(budgetAwareSerialize([], null)).toEqual([]);
	});

	it('returns full content when all fits within budget', () => {
		const p = makePanelContext({ panelId: 'p1', content: 'small', tokenEstimate: 2 });
		const result = budgetAwareSerialize([p], 'p1', CONTEXT_TOKEN_BUDGET);
		expect(result).toHaveLength(1);
		expect(result[0].contentLevel).toBe('full');
		expect(result[0].content).toBe('small');
		expect(result[0].status).toBe('focused');
	});

	it('focused panel appears first regardless of token size', () => {
		const small = makePanelContext({ panelId: 'small', content: 'a', tokenEstimate: 1 });
		const big = makePanelContext({ panelId: 'big', content: 'x'.repeat(100), tokenEstimate: 25 });
		const result = budgetAwareSerialize([small, big], 'big', CONTEXT_TOKEN_BUDGET);
		expect(result[0].status).toBe('focused');
		expect(result[0].label).toBe(big.label);
	});

	it('assigns summary level when budget crosses 70% threshold', () => {
		// Budget = 100 tokens. First panel uses 75 (over 70%)
		const big = makePanelContext({ panelId: 'big', content: 'x'.repeat(300), tokenEstimate: 75 });
		const small = makePanelContext({ panelId: 'small', content: 'y'.repeat(200), tokenEstimate: 50 });
		const result = budgetAwareSerialize([big, small], 'big', 100);
		// First panel should be full (it's focused and fills first)
		expect(result[0].contentLevel).toBe('full');
		// Second panel should be summary or title-only (budget is tight)
		expect(['summary', 'title-only']).toContain(result[1].contentLevel);
	});

	it('always includes focused panel even when budget is very small', () => {
		const big = makePanelContext({ panelId: 'big', content: 'x'.repeat(1000), tokenEstimate: 250 });
		const result = budgetAwareSerialize([big], 'big', 10);
		expect(result).toHaveLength(1);
		// Should be included at some level
		expect(result[0].status).toBe('focused');
	});

	it('skips non-focused panels when budget is exhausted', () => {
		const focused = makePanelContext({ panelId: 'f', label: 'Focused', content: 'x'.repeat(400), tokenEstimate: 100 });
		const extra = makePanelContext({ panelId: 'e', label: 'Extra', content: 'y'.repeat(400), tokenEstimate: 100 });
		const result = budgetAwareSerialize([focused, extra], 'f', 100);
		// Focused fills the entire budget, extra should be excluded or title-only
		const extraEntry = result.find((r) => r.label === 'Extra');
		if (extraEntry) {
			expect(extraEntry.contentLevel).toBe('title-only');
		}
	});

	it('does not mutate the input array', () => {
		const a = makePanelContext({ panelId: 'a' });
		const b = makePanelContext({ panelId: 'b' });
		const input = [a, b];
		const inputCopy = [...input];
		budgetAwareSerialize(input, 'a', CONTEXT_TOKEN_BUDGET);
		expect(input).toEqual(inputCopy);
	});

	it('marks non-focused entries as active status', () => {
		const f = makePanelContext({ panelId: 'f', content: 'a', tokenEstimate: 1 });
		const p = makePanelContext({ panelId: 'p', content: 'b', tokenEstimate: 1 });
		const result = budgetAwareSerialize([f, p], 'f', CONTEXT_TOKEN_BUDGET);
		expect(result[0].status).toBe('focused');
		expect(result[1].status).toBe('active');
	});
});
