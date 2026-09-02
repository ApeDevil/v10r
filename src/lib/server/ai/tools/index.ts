/**
 * Desk tool factory — assembles tools based on granted scopes.
 * Auth is captured via userId closure — no per-tool re-auth.
 */

import type { ToolSet } from 'ai';
import type { Locale } from '$lib/i18n';
import type { SearchResult } from '$lib/search/types';
import { DESK_MUTATE_MAX_STEPS, DESK_READ_MAX_STEPS } from '$lib/server/ai/config';
import { compactToolResult } from '$lib/server/ai/loop/compact';
import { TOOL_MANIFEST, type ToolDescriptor } from '$lib/types/ai-tools';
import type { DeskLayoutEntry, DeskToolMeta, DeskToolScope, ToolMeta, ToolRisk } from './_types';
import { createAskTools } from './desk-ask';
import { createCreateTools, createDeleteTools } from './desk-create';
import { createReadTools } from './desk-read';
import { createWriteTools } from './desk-write';
import { createGetLlmwikiPagesTool } from './get-llmwiki-pages';
import { createGetRetrievalChunksTool, type DrilledChunkSink } from './get-source-chunks';
import { createProposePlanTool } from './propose-plan';
import { createResolveRefTool } from './resolve-ref';
import { type CatalogSink, createSearchCatalogTool } from './search-catalog';
import { createSearchDocsTool } from './search-docs';
import { createSearchPatternLibraryTool } from './search-pattern-library';

// The declarative tool registry now lives in the client-safe `$lib/types/ai-tools.ts`
// (the showcase topology renders from the same source). Re-exported here so server-side
// consumers keep one import site; the meta maps below are still derived from it.
export { TOOL_MANIFEST } from '$lib/types/ai-tools';
export type {
	DeskEffect,
	DeskLayoutEntry,
	DeskToolMeta,
	DeskToolScope,
	ToolDescriptor,
	ToolMeta,
	ToolRisk,
} from './_types';

/** Chatbot (retrieval) tool metadata — read-only, NO scope field. Derived from the manifest. */
export const chatbotToolMeta: Record<string, ToolMeta> = Object.fromEntries(
	TOOL_MANIFEST.filter((d) => d.surface === 'chatbot').map((d) => [d.name, { risk: d.risk }]),
);

/** Deskbot tool metadata — risk + the desk scope that gates each tool. Derived from the manifest. */
export const deskbotToolMeta: Record<string, DeskToolMeta> = Object.fromEntries(
	TOOL_MANIFEST.filter((d): d is Extract<ToolDescriptor, { surface: 'deskbot' }> => d.surface === 'deskbot').map(
		(d) => [d.name, { risk: d.risk, scope: d.scope }],
	),
);

/** Union of both surfaces — for admin/telemetry that needs every tool regardless of surface. */
export const allToolMeta: Record<string, ToolMeta> = { ...chatbotToolMeta, ...deskbotToolMeta };

/** Get the risk classification for a tool name, or `undefined` if unknown. */
export function getToolRisk(toolName: string): ToolRisk | undefined {
	return allToolMeta[toolName]?.risk;
}

/**
 * Wrap a tool's `execute` so its return value passes through `compactToolResult`
 * before the AI SDK sees it. Oversized results become `{ ref, summary, truncated,
 * originalBytes, hint }` projections and the full value is stashed in the
 * request-scoped compaction context for `resolve_ref` to pull back.
 *
 * This is the load-bearing piece of the AI SDK #9631 workaround: compact at
 * execute time, not in `prepareStep` (which is silently ignored).
 */
function wrapToolsWithCompaction(tools: ToolSet): ToolSet {
	const wrapped: Record<string, unknown> = {};
	for (const [name, toolDef] of Object.entries(tools)) {
		const def = toolDef as Record<string, unknown>;
		const originalExecute = def.execute as ((...args: unknown[]) => Promise<unknown>) | undefined;
		if (!originalExecute) {
			wrapped[name] = toolDef;
			continue;
		}
		wrapped[name] = {
			...def,
			execute: async (...args: unknown[]) => {
				const result = await originalExecute(...args);
				return compactToolResult(name, result);
			},
		};
	}
	return wrapped as ToolSet;
}

/** Read-only desk scopes — neither gates the plan loop nor counts toward the mutation step budget. */
const READONLY_SCOPES: ReadonlySet<DeskToolScope> = new Set(['desk:read', 'desk:ask']);

/** True when any granted scope can mutate desk state (write/create/delete). */
function hasMutatingScope(scopes: DeskToolScope[]): boolean {
	return scopes.some((s) => !READONLY_SCOPES.has(s));
}

export function createDeskTools(userId: string, scopes: DeskToolScope[] = [], deskLayout?: DeskLayoutEntry[]): ToolSet {
	const tools: ToolSet = {} as ToolSet;

	// Read tools available when any desk scope is granted
	if (scopes.length > 0) {
		Object.assign(tools, createReadTools(userId, deskLayout));
	}

	if (scopes.includes('desk:write')) {
		Object.assign(tools, createWriteTools(userId));
	}

	if (scopes.includes('desk:create')) {
		Object.assign(tools, createCreateTools(userId));
	}

	if (scopes.includes('desk:delete')) {
		Object.assign(tools, createDeleteTools(userId));
	}

	// desk:ask — read-only retrieval grounding over the user's own files (deskbot retrieval profile).
	if (scopes.includes('desk:ask')) {
		Object.assign(tools, createAskTools(userId));
	}

	// Register the plan-before-execute primitive whenever a mutating scope is
	// enabled. The governor's `shouldRequirePlan` predicate decides whether to
	// actually *instruct* the model to use it via the `<planning>` prompt block.
	if (hasMutatingScope(scopes)) {
		Object.assign(tools, createProposePlanTool());
	}

	// Always register resolve_ref when any tool is available — it's the escape hatch
	// for the compaction context (AI SDK #9631 workaround).
	if (Object.keys(tools).length > 0) {
		Object.assign(tools, createResolveRefTool());
	}

	return wrapToolsWithCompaction(tools);
}

/** Determine step limit based on tool scopes. Read-only (incl. desk:ask) vs mutation budgets. */
export function stepsForScopes(scopes: DeskToolScope[]): number {
	return hasMutatingScope(scopes) ? DESK_MUTATE_MAX_STEPS : DESK_READ_MAX_STEPS;
}

/**
 * Build the retrieval tool set for a chat turn.
 *
 * Returns both tools plus a `drilledChunks` set populated by any
 * `get_source_chunks` invocation during the turn. Pass that set to
 * `verifyCitations` after `streamText` resolves.
 *
 * Compaction wrapping is applied consistently with desk tools.
 */
export function buildRetrievalTools(
	userId: string,
	locale: Locale,
	authCeiling: string | null,
): { tools: ToolSet; drilledChunks: Set<string>; surfacedCatalog: Map<string, SearchResult> } {
	const drilledChunks = new Set<string>();
	const sink: DrilledChunkSink = {
		record(ids) {
			for (const id of ids) drilledChunks.add(id);
		},
	};

	// Live, deduped view of catalog rows the model surfaced this turn — read after
	// the stream resolves to ground citation chips + the surface-citation verifier.
	const surfacedCatalog = new Map<string, SearchResult>();
	const catalogSink: CatalogSink = {
		record(rows) {
			for (const r of rows) surfacedCatalog.set(r.id, r);
		},
	};

	const raw: ToolSet = {
		...createGetLlmwikiPagesTool(userId),
		...createGetRetrievalChunksTool(userId, sink),
		...createSearchCatalogTool(locale, authCeiling, catalogSink),
		// Semantic retrieval over the project docs corpus (system-owned). Feeds the same
		// catalog sink → docs citations render as chips and pass the surface verifier.
		...createSearchDocsTool(locale, catalogSink),
		// The canonical pattern registry (same data both MCP runtimes serve). Feeds the
		// same sink → /docs/pattern-library/<id> citations render as chips too.
		...createSearchPatternLibraryTool(locale, catalogSink),
		// Compaction escape hatch (AI SDK #9631). Both harnesses apply
		// wrapToolsWithCompaction below, so a compacted get_source_chunks result yields a
		// ref the model can only pull back via resolve_ref — it MUST be registered here too.
		...createResolveRefTool(),
	} as ToolSet;

	return { tools: wrapToolsWithCompaction(raw), drilledChunks, surfacedCatalog };
}
