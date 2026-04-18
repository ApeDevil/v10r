/**
 * Desk tool factory — assembles tools based on granted scopes.
 * Auth is captured via userId closure — no per-tool re-auth.
 */

import type { ToolSet } from 'ai';
import { compactToolResult } from '$lib/server/ai/loop/compact';
import type { DeskLayoutEntry, DeskToolMeta, DeskToolScope } from './_types';
import { createCreateTools, createDeleteTools, createToolMeta, deleteToolMeta } from './desk-create';
import { createReadTools, readToolMeta } from './desk-read';
import { createWriteTools, writeToolMeta } from './desk-write';
import { createGetLlmwikiPagesTool, llmwikiPagesToolMeta } from './get-llmwiki-pages';
import { createGetRawragChunksTool, type DrilledChunkSink, rawragChunksToolMeta } from './get-rawrag-chunks';
import { createProposePlanTool, proposePlanMeta } from './propose-plan';
import { createResolveRefTool } from './resolve-ref';

export type { DeskEffect, DeskLayoutEntry, DeskToolMeta, DeskToolRisk, DeskToolScope } from './_types';

/** Unified metadata lookup — covers every desk tool across all scopes. */
export const deskToolMeta: Record<string, DeskToolMeta> = {
	...readToolMeta,
	...writeToolMeta,
	...createToolMeta,
	...deleteToolMeta,
	...proposePlanMeta,
	...llmwikiPagesToolMeta,
	...rawragChunksToolMeta,
};

/** Get the risk classification for a tool name, or `undefined` if unknown. */
export function getToolRisk(toolName: string): DeskToolMeta['risk'] | undefined {
	return deskToolMeta[toolName]?.risk;
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

export function createDeskTools(userId: string, scopes: DeskToolScope[], deskLayout?: DeskLayoutEntry[]): ToolSet {
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

	// Register the plan-before-execute primitive whenever a mutating scope is
	// enabled. The governor's `shouldRequirePlan` predicate decides whether to
	// actually *instruct* the model to use it via the `<planning>` prompt block.
	const hasMutatingScope = scopes.some((s) => s !== 'desk:read');
	if (hasMutatingScope) {
		Object.assign(tools, createProposePlanTool());
	}

	// Always register resolve_ref when any tool is available — it's the escape hatch
	// for the compaction context (AI SDK #9631 workaround).
	if (Object.keys(tools).length > 0) {
		Object.assign(tools, createResolveRefTool());
	}

	return wrapToolsWithCompaction(tools);
}

/** Determine step limit based on tool scopes. Read-only = 3, mutation = 5. */
export function stepsForScopes(scopes: DeskToolScope[]): number {
	return scopes.some((s) => s !== 'desk:read') ? 5 : 3;
}

/**
 * Build the retrieval tool set for a chat turn.
 *
 * Returns both tools plus a `drilledChunks` set populated by any
 * `get_rawrag_chunks` invocation during the turn. Pass that set to
 * `verifyCitations` after `streamText` resolves.
 *
 * Compaction wrapping is applied consistently with desk tools.
 */
export function buildRetrievalTools(userId: string): { tools: ToolSet; drilledChunks: Set<string> } {
	const drilledChunks = new Set<string>();
	const sink: DrilledChunkSink = {
		record(ids) {
			for (const id of ids) drilledChunks.add(id);
		},
	};

	const raw: ToolSet = {
		...createGetLlmwikiPagesTool(userId),
		...createGetRawragChunksTool(userId, sink),
	} as ToolSet;

	return { tools: wrapToolsWithCompaction(raw), drilledChunks };
}
