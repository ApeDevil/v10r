/**
 * Drift guard: the showcase's hand-curated tool cards must match the MCP server's live tool
 * list 1:1, in order. Both transports advertise byte-identical definitions — they are built from
 * `pattern-library/query.ts`, and `server/mcp/patterns/parity.test.ts` pins stdio to hosted — so
 * the hosted list stands for both.
 */
import { describe, expect, it } from 'vitest';
import { PATTERN_TOOLS } from '$lib/server/mcp/patterns/tools';
import { TOOL_CARDS } from './tool-cards';

describe('tool card drift', () => {
	it('mirrors the live MCP tool names exactly, in order', () => {
		expect(TOOL_CARDS.map((card) => card.name)).toEqual(PATTERN_TOOLS.map((tool) => tool.name));
	});

	it('lists exactly the live parameters of each tool, in schema order', () => {
		for (const card of TOOL_CARDS) {
			const tool = PATTERN_TOOLS.find((candidate) => candidate.name === card.name);
			const properties = (tool?.inputSchema.properties ?? {}) as Record<string, unknown>;
			expect(
				card.params.map((param) => param.name),
				card.name,
			).toEqual(Object.keys(properties));
		}
	});
});
