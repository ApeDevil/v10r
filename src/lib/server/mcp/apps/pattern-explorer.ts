/**
 * The pattern explorer MCP App: the `explore_patterns` tool and the View a supporting host
 * renders for it (SEP-1865), served on the public and private hosted surfaces next to the other
 * Pattern tools. See docs/blueprint/ai/mcp-apps.md.
 *
 * What is here is composition only. The graph projection is `pattern-library/dependency-explorer.ts`
 * (framework-free, the same registry every other tool reads); the View is a generated, self-contained
 * document (`pattern-explorer.view.html`, built by `scripts/mcp/build-app-views.ts`); the SDK bridge
 * (`#mcp/tool-server.ts`) registers both through the official `ext-apps/server` helpers.
 *
 * One tool answers every client. It returns the markdown answer AND the same projection as
 * `structuredContent`: a host with MCP Apps renders the View from the JSON; any other client
 * reads the text. The JSON is complete on its own, because Claude Code shows the model only the
 * structured payload when both are present (mcp/README.md).
 */

import { REGISTRY } from '#lib/server/patterns/index.ts';
import type { AppView } from '#mcp/tool-server.ts';
import { EXPLORE_PATTERNS_TOOL_NAME, explorePatterns } from '#patterns/dependency-explorer.ts';
import { publicPatternRegistry } from '../patterns/tools';
import { errorResult, type ToolRegistry, type ToolResult } from '../types';
import viewDocument from './pattern-explorer.view.html?raw';

export const PATTERN_EXPLORER_URI = 'ui://v10r/pattern-explorer.html';

/**
 * The View's `_meta.ui`. Every CSP list is empty — no fetch, no remote script/style/image/font,
 * no nested frame, no base change — and no device permission is requested: the View needs
 * nothing beyond the host bridge. `prefersBorder` asks for a framed card, since the View paints
 * its own background.
 */
export const PATTERN_EXPLORER_VIEW: AppView = {
	uri: PATTERN_EXPLORER_URI,
	name: 'Pattern dependency explorer',
	description:
		"Interactive explorer over the v10r pattern registry's dependency graph: pick a pattern, see what it builds on and what builds on it.",
	tool: EXPLORE_PATTERNS_TOOL_NAME,
	html: viewDocument,
	ui: {
		csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] },
		permissions: {},
		prefersBorder: true,
	},
};

function explorePatternsTool(args: unknown, siteOrigin: string): ToolResult {
	const params = typeof args === 'object' && args !== null && !Array.isArray(args) ? args : {};
	const outcome = explorePatterns(REGISTRY, params as Record<string, unknown>, { siteOrigin });
	if (!outcome.ok) return errorResult(outcome.text, outcome.diag, outcome.next);
	return { content: [{ type: 'text', text: outcome.text }], structuredContent: outcome.exploration };
}

/**
 * The read-only Pattern registry plus the explorer's View, for one request. `explore_patterns`
 * itself is a shared query tool (`pattern-library/query.ts`), answered as text by both
 * transports; here the hosted surface attaches its View and answers it with the same projection
 * as structured content. `siteOrigin` is the deployment the request reached, so the docs links in
 * an answer point at the same deployment.
 */
export function patternRegistryWithExplorer(siteOrigin: string): ToolRegistry {
	return {
		tools: publicPatternRegistry.tools,
		views: [PATTERN_EXPLORER_VIEW],
		dispatch(name, args) {
			if (name === EXPLORE_PATTERNS_TOOL_NAME) return explorePatternsTool(args, siteOrigin);
			return publicPatternRegistry.dispatch(name, args);
		},
	};
}

/** The tool names this surface serves — what telemetry counts as a known tool. */
export const EXPLORER_SURFACE_TOOL_NAMES: readonly string[] = publicPatternRegistry.tools.map((tool) => tool.name);
