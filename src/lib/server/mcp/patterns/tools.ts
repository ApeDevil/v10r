/**
 * The PUBLIC read-only tool registry: the six Pattern tools, exposed by `/api/mcp/public` and
 * `/api/mcp/private`. Structurally read-only — there is no mutation tool here to dispatch.
 *
 * The tool contract and the four registry tools live once in `pattern-library/query.ts`, shared
 * with the stdio server. This file adds only what is hosted-specific: `get_file_excerpt` over the
 * build-time snapshot and its allowlist (`excerpts.ts`), the shared snippet engine, and the mapping
 * of an outcome to a wire result that keeps `diag` for telemetry.
 */

import { REGISTRY } from '$lib/server/patterns';
import {
	excerptRequest,
	LIST_EVERYTHING,
	QUERY_TOOLS,
	QUERY_WORKFLOW,
	type QueryOutcome,
	REGISTRY_QUERIES,
	validateSnippetDef,
} from '$patterns/query';
import { renderReport, validateSnippet } from '../snippet/engine';
import { MAX_SNIPPET_CHARS } from '../snippet/rules';
import { errorResult, type ToolDef, type ToolRegistry, type ToolResult, textResult } from '../types';
import { readAllowlistedExcerpt } from './excerpts';

export const PATTERN_TOOLS: ToolDef[] = [...QUERY_TOOLS, validateSnippetDef(MAX_SNIPPET_CHARS)];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The discriminated union carries the reason across; there is deliberately no `??` fallback,
 *  because a default here is how a new failure branch would silently get the wrong reason. */
function fromOutcome(outcome: QueryOutcome): ToolResult {
	return outcome.ok ? textResult(outcome.text) : errorResult(outcome.text, outcome.diag, outcome.next);
}

function getFileExcerpt(args: Record<string, unknown>): ToolResult {
	const request = excerptRequest(args);
	if (!request.ok) return errorResult(request.text, 'invalid_args', request.next);
	const excerpt = readAllowlistedExcerpt(request.path, request);
	return excerpt.ok ? textResult(excerpt.text) : errorResult(excerpt.text, excerpt.diag, excerpt.next);
}

function validateSnippetTool(args: Record<string, unknown>): ToolResult {
	// Its own bound, not MAX_ARG_CHARS: a snippet is legitimately larger than any other
	// argument on this surface, and the bound is stated in the schema. Refuse rather than
	// truncate — a partially validated snippet reads as clean and is not.
	const snippet = typeof args.snippet === 'string' && args.snippet.length <= MAX_SNIPPET_CHARS ? args.snippet : null;
	if (snippet === null || snippet.trim().length === 0) {
		return errorResult(
			`"snippet" must be a non-empty string of at most ${MAX_SNIPPET_CHARS} characters. Refused rather than truncated — a partially validated snippet reads as clean.`,
			'invalid_args',
			[{ tool: 'validate_snippet', args: { language: 'svelte' }, why: 'resubmit with the snippet argument set.' }],
		);
	}
	const language = args.language === 'ts' ? 'ts' : 'svelte';
	// Findings are a SUCCESS, not an error: this is a completed validation, an isError
	// would make agent loops treat the normal case as a failure, and it would mint
	// mcp.call_log rows that corrupt the capability-gaps meter.
	return textResult(renderReport(validateSnippet(snippet, language)));
}

const TRANSPORT_HANDLERS: Record<string, (args: Record<string, unknown>) => ToolResult> = {
	get_file_excerpt: getFileExcerpt,
	validate_snippet: validateSnippetTool,
};

/** The public read-only Pattern MCP registry. */
export const publicPatternRegistry: ToolRegistry = {
	tools: PATTERN_TOOLS,
	dispatch(name, args) {
		const params = isRecord(args) ? args : {};
		const query = REGISTRY_QUERIES[name];
		if (query) return fromOutcome(query(REGISTRY, params));
		const handler = TRANSPORT_HANDLERS[name];
		if (!handler) {
			return errorResult(
				`Unknown tool "${name}". Available: ${PATTERN_TOOLS.map((tool) => tool.name).join(', ')}.`,
				'unknown_tool',
				[LIST_EVERYTHING],
			);
		}
		return handler(params);
	},
};

export const PUBLIC_MCP_INSTRUCTIONS = `Hosted, read-only mirror of the v10r pattern library. ${QUERY_WORKFLOW} On this endpoint get_file_excerpt reads only files cited by deep pattern cards. Read-only: no state is mutated.`;
