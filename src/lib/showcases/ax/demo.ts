/**
 * Pure helpers for the /showcases/ax live demos. Client-bundled — no $lib/server,
 * no mcp/*.ts imports; everything here works on strings the browser fetched itself.
 *
 * The dirty demo snippet lives here (not in the page) because it contains a
 * literal `</script>`, which would terminate a .svelte script block.
 */

/** JSON-RPC envelope for a hosted-MCP tools/call POST. Always carries an id — id-less messages are notifications and get a 202 with no body. */
export function toolCallBody(name: string, args: Record<string, unknown>, id: number) {
	return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } } as const;
}

export interface ToolCallOutcome {
	text: string;
	isError: boolean;
}

/** Extracts the text block from a tools/call response envelope; tolerant of any malformed shape. */
export function parseToolResult(payload: unknown): ToolCallOutcome {
	const result = (payload as { result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean } })
		?.result;
	const text = result?.content?.find((block) => block.type === 'text')?.text ?? '';
	return { text, isError: result?.isError === true };
}

export interface ParsedErrorText {
	body: string;
	actions: string[];
}

/**
 * Splits a tool error body from its "## Next actions" recovery trailer — the
 * same fixed-heading contract an agent parses. Text without a trailer (success
 * results, transport errors) comes back with an empty actions list.
 */
export function splitNextActions(text: string): ParsedErrorText {
	const heading = '## Next actions';
	const index = text.lastIndexOf(`\n\n${heading}\n`);
	if (index === -1) return { body: text, actions: [] };
	const trailer = text.slice(index + heading.length + 3);
	const actions = trailer
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => /^\d+\.\s/.test(line));
	return { body: text.slice(0, index), actions };
}

export interface LlmsStats {
	lines: number;
	docUrls: number;
}

/** Line count and `.md` doc-link count of a fetched /llms.txt body. */
export function llmsStats(text: string): LlmsStats {
	const docUrls = text.match(/\(https?:\/\/[^)]*\/docs\/[^)]+\.md\)/g)?.length ?? 0;
	return { lines: text.split('\n').length, docUrls };
}

/** First `max` lines of a fetched body, with an ellipsis line when truncated. */
export function headExcerpt(text: string, max: number): string {
	const lines = text.split('\n');
	if (lines.length <= max) return text;
	return `${lines.slice(0, max).join('\n')}\n…`;
}

/**
 * The pre-filled validate_snippet demo input. Deliberately violates several
 * conventions (zod import, export let, `$:`, raw <button>, on: directive, hex
 * color) but NOT the token-opacity rule — the repo's own opacity-guard scans
 * every string in src/ and would flag a literal `bg-<token>/NN` here.
 */
export const DIRTY_SNIPPET = `<script>
import { z } from 'zod';
export let count = 0;
$: doubled = count * 2;
</script>

<button on:click={() => count++} style="color: #ff6b6b">
	Count: {doubled}
</button>
`;
