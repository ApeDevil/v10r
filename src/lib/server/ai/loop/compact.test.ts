/**
 * Unit tests for the tool-result compaction module.
 *
 * Focus: pure-function correctness, context isolation across concurrent
 * requests, ref round-trip via `resolveRef`, and the message-walker path
 * for loaded history.
 */
import { describe, expect, it } from 'vitest';
import {
	compactToolResult,
	compactToolResults,
	DEFAULT_BUDGET,
	projectSummary,
	resolveRef,
	runWithCompaction,
} from './compact';

describe('projectSummary', () => {
	it('returns strings unchanged when below budget', () => {
		expect(projectSummary('hello', 100)).toBe('hello');
	});

	it('truncates oversized strings with an ellipsis', () => {
		const result = projectSummary('a'.repeat(20), 5);
		expect(result).toBe('aaaaa…');
	});

	it('serializes non-strings via JSON', () => {
		const result = projectSummary({ a: 1, b: 'x' }, 100);
		expect(result).toBe('{"a":1,"b":"x"}');
	});

	it('truncates serialized objects that exceed budget', () => {
		const big = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `item_${i}` })) };
		const result = projectSummary(big, 30);
		expect(result.length).toBe(31); // 30 chars + ellipsis
		expect(result.endsWith('…')).toBe(true);
	});
});

describe('compactToolResult', () => {
	it('is a no-op outside a compaction context', () => {
		const value = { huge: 'x'.repeat(10_000) };
		expect(compactToolResult('any', value)).toBe(value);
	});

	it('returns the value unchanged when under budget', () => {
		runWithCompaction(DEFAULT_BUDGET, () => {
			const value = { small: 'ok' };
			expect(compactToolResult('desk_list_files', value)).toBe(value);
		});
	});

	it('replaces oversized results with a ref projection', () => {
		runWithCompaction({ maxChars: 100, summaryChars: 40 }, () => {
			const value = { rows: 'x'.repeat(500) };
			const compacted = compactToolResult('desk_read_file', value) as {
				ref: string;
				summary: string;
				truncated: true;
				originalBytes: number;
				hint: string;
			};
			expect(compacted.truncated).toBe(true);
			expect(compacted.ref).toMatch(/^tr_desk_read_file_\d+$/);
			expect(compacted.summary.length).toBeLessThanOrEqual(41); // 40 + ellipsis
			expect(compacted.originalBytes).toBeGreaterThan(100);
			expect(compacted.hint).toContain(compacted.ref);
		});
	});

	it('stores the full value so resolveRef returns it', () => {
		runWithCompaction({ maxChars: 50, summaryChars: 20 }, () => {
			const value = { payload: 'a'.repeat(200) };
			const compacted = compactToolResult('tool_x', value) as { ref: string };
			expect(resolveRef(compacted.ref)).toBe(value);
		});
	});

	it('increments the ref counter across multiple compactions', () => {
		runWithCompaction({ maxChars: 10, summaryChars: 5 }, () => {
			const a = compactToolResult('t', { x: 'a'.repeat(100) }) as { ref: string };
			const b = compactToolResult('t', { x: 'b'.repeat(100) }) as { ref: string };
			expect(a.ref).not.toBe(b.ref);
			expect(a.ref).toMatch(/_0$/);
			expect(b.ref).toMatch(/_1$/);
		});
	});
});

describe('resolveRef', () => {
	it('returns undefined outside a compaction context', () => {
		expect(resolveRef('tr_anything_0')).toBeUndefined();
	});

	it('returns undefined for unknown refs', () => {
		runWithCompaction(DEFAULT_BUDGET, () => {
			expect(resolveRef('tr_does_not_exist_99')).toBeUndefined();
		});
	});
});

describe('runWithCompaction context isolation', () => {
	it('keeps refs scoped to each top-level run', () => {
		const refA = runWithCompaction({ maxChars: 5, summaryChars: 2 }, () => {
			return (compactToolResult('t', { big: 'aaaaaaaaaa' }) as { ref: string }).ref;
		});
		// Outside the run, the ref is gone.
		expect(resolveRef(refA)).toBeUndefined();
	});

	it('nested calls reuse the outer context', () => {
		runWithCompaction({ maxChars: 5, summaryChars: 2 }, () => {
			const outer = compactToolResult('t', { big: 'aaaaaaaaaa' }) as { ref: string };
			runWithCompaction(DEFAULT_BUDGET, () => {
				// Inner reuses outer context, so the outer ref is still resolvable.
				expect(resolveRef(outer.ref)).toBeDefined();
			});
		});
	});
});

describe('compactToolResults (message walker)', () => {
	it('leaves non-tool messages untouched', () => {
		const messages = [
			{ role: 'user', content: 'hi' },
			{ role: 'assistant', content: 'hello' },
		] as never[];
		expect(compactToolResults(messages)).toEqual(messages);
	});

	it('compacts oversized tool-result parts inside tool messages', () => {
		runWithCompaction({ maxChars: 50, summaryChars: 20 }, () => {
			const input = [
				{
					role: 'tool',
					content: [
						{
							type: 'tool-result',
							toolCallId: 'call_1',
							toolName: 'desk_read_file',
							output: { rows: 'x'.repeat(500) },
						},
					],
				},
			] as never[];
			const out = compactToolResults(input);
			const part = (out[0] as unknown as { content: Array<{ output: { truncated?: boolean; ref?: string } }> })
				.content[0];
			expect(part.output.truncated).toBe(true);
			expect(part.output.ref).toBeDefined();
		});
	});

	it('leaves small tool-result parts untouched', () => {
		runWithCompaction(DEFAULT_BUDGET, () => {
			const input = [
				{
					role: 'tool',
					content: [
						{
							type: 'tool-result',
							toolCallId: 'call_1',
							toolName: 'desk_list_files',
							output: { files: [] },
						},
					],
				},
			] as never[];
			const out = compactToolResults(input);
			expect(out).toEqual(input);
		});
	});
});
