/**
 * The six read-only tools of the v10r Pattern MCP, stdio side. The tool contract and the four
 * registry tools live once in `pattern-library/query.ts` (shared with the hosted transport);
 * this file adds only what is stdio-specific: `get_file_excerpt` over the read-only mount
 * (`security.ts`), the `validate_snippet` engine (`snippet.ts`), and the mapping of an outcome to
 * a wire result. Definitions carry name/description/inputSchema only — `outputSchema`, `title`
 * or `annotations` trigger a Claude Code bug that silently drops the whole server's tool list.
 */

import {
	EXCERPT_RECOVERY,
	excerptRequest,
	LIST_EVERYTHING,
	type NextAction,
	QUERY_TOOLS,
	type QueryOutcome,
	REGISTRY_QUERIES,
	type ToolDef,
	validateSnippetDef,
	withNextActions,
} from '../pattern-library/query.ts';
import type { Registry } from '../pattern-library/schema.ts';
import { readExcerpt } from './security.ts';
import { validateSnippetStdio } from './snippet.ts';
import snippetRules from './snippet-rules.json';

interface ToolResult {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
}

export interface ToolContext {
	registry: Registry | null;
	loadError: string | null;
	root?: string;
}

export const TOOLS: ToolDef[] = [...QUERY_TOOLS, validateSnippetDef(snippetRules.maxSnippetChars)];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Results are text-only by design: when structuredContent is present, Claude Code shows
 * the model ONLY the structured payload and hides the text body (observed in E2E) —
 * and community practice favors markdown over nested JSON for agent consumption anyway.
 */
function text(body: string): ToolResult {
	return { content: [{ type: 'text', text: body }] };
}

/** `actions` is required for the same reason the hosted `errorResult` requires it: a new
 *  error branch that strands the caller must be a missing-argument error, not a review miss. */
function fail(body: string, actions: readonly NextAction[]): ToolResult {
	return { content: [{ type: 'text', text: withNextActions(body, actions) }], isError: true };
}

/** The stdio wire carries no telemetry, so an outcome's `diag` has nowhere to go. */
function fromOutcome(outcome: QueryOutcome): ToolResult {
	return outcome.ok ? text(outcome.text) : fail(outcome.text, outcome.next);
}

function getFileExcerpt(args: Record<string, unknown>, root?: string): ToolResult {
	const request = excerptRequest(args);
	if (!request.ok) return fail(request.text, request.next);
	let excerpt: ReturnType<typeof readExcerpt>;
	try {
		excerpt = root ? readExcerpt(request.path, request, root) : readExcerpt(request.path, request);
	} catch (cause) {
		return fail(`could not read '${request.path}': ${String(cause)}`, [EXCERPT_RECOVERY]);
	}
	if (excerpt.ok) return text(excerpt.text);
	return fail(excerpt.text, [
		excerpt.reason === 'unreadable'
			? EXCERPT_RECOVERY
			: { tool: 'get_file_excerpt', args: { start_line: 1 }, why: 'read the file by line range instead.' },
	]);
}

export function handleToolCall(name: string, args: unknown, ctx: ToolContext): ToolResult {
	const known = TOOLS.some((tool) => tool.name === name);
	if (!known) {
		return fail(`Unknown tool "${name}". Available: ${TOOLS.map((tool) => tool.name).join(', ')}.`, [LIST_EVERYTHING]);
	}
	const params = isRecord(args) ? args : {};
	if (name === 'get_file_excerpt') {
		return getFileExcerpt(params, ctx.root);
	}
	if (name === 'validate_snippet') {
		// Findings are a SUCCESS (a completed validation); only malformed arguments or a
		// broken rule file are errors.
		const outcome = ctx.root ? validateSnippetStdio(params, ctx.root) : validateSnippetStdio(params);
		return outcome.ok
			? text(outcome.text)
			: fail(outcome.text, [
					{ tool: 'validate_snippet', args: { language: 'svelte' }, why: 'resubmit with the snippet argument set.' },
				]);
	}
	if (!ctx.registry) {
		return fail(
			`The pattern registry failed to load: ${ctx.loadError ?? 'unknown error'}. Fix pattern-library/registry.json and restart.`,
			[
				{
					tool: 'get_file_excerpt',
					args: { path: 'pattern-library/registry.json' },
					why: 'still works without the registry — read the file to see what is malformed.',
				},
			],
		);
	}
	const query = REGISTRY_QUERIES[name];
	if (!query) {
		return fail(`Tool "${name}" is defined but has no handler — this is a server bug.`, [LIST_EVERYTHING]);
	}
	return fromOutcome(query(ctx.registry, params));
}
