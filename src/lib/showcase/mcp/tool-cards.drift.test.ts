/**
 * Drift guard: the showcase's hand-curated tool cards must match the MCP
 * server's live TOOLS array 1:1. mcp/tools.ts is Bun-typed (import.meta.dir
 * upstream) and outside the app's TS program, so the guard reads it as text
 * instead of importing it — importing would break `bun run check`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_CARDS } from './tool-cards';

function liveToolNames(): string[] {
	const source = readFileSync(join(process.cwd(), 'mcp', 'tools.ts'), 'utf8');
	const start = source.indexOf('export const TOOLS');
	const end = source.indexOf('\n];', start);
	expect(start).toBeGreaterThan(-1);
	expect(end).toBeGreaterThan(start);
	const block = source.slice(start, end);
	return [...block.matchAll(/name: '([a-z_]+)'/g)].map((match) => match[1] ?? '');
}

describe('tool card drift', () => {
	it('mirrors the live mcp/tools.ts TOOLS names exactly, in order', () => {
		expect(TOOL_CARDS.map((card) => card.name)).toEqual(liveToolNames());
	});
});
