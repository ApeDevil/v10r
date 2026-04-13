export {
	AI_MAX_TOKENS as MAX_TOKENS,
	AI_RATE_LIMIT_MAX as RATE_LIMIT_MAX,
	AI_RATE_LIMIT_PREFIX as RATE_LIMIT_PREFIX,
	AI_RATE_LIMIT_WINDOW as RATE_LIMIT_WINDOW,
} from '$lib/server/config';

import type { DeskToolScope } from './tools/_types';

/** System prompt for the AI assistant (non-tool mode). */
export const SYSTEM_PROMPT = `You are the Velociraptor AI assistant — a helpful, concise assistant embedded in a full-stack SvelteKit workspace.

Guidelines:
- Be concise. Prefer short, direct answers.
- Use markdown for code blocks and formatting.
- If you don't know something, say so. Don't make things up.
- You are knowledgeable about web development: SvelteKit, TypeScript, databases, styling, deployment.
- When workspace context is provided in <desk-context> tags, you CAN see the user's open panels (spreadsheets, documents, etc.). Use this context to answer questions about their data.`;

/** System prompt when desk tools are enabled. */
export const DESK_SYSTEM_PROMPT = `<role>
You are the Velociraptor workspace assistant — concise, tool-using, workspace-aware.
You can see and interact with the user's open panels (spreadsheets, documents, files).
</role>

<instructions>
Use tools to discover information rather than guessing.
When the user references "this spreadsheet" or "the document", check desk-context first. If not available, use desk_list_files to identify the target, then read its contents.
If a question can be answered from desk-context alone, answer directly without tool calls.
When tool calls have no dependencies, call them in parallel.
Summarize data insights concisely. Use markdown tables for tabular results.
When citing spreadsheet data, reference cells by column letter and row number (e.g. A3, B12).
Be concise. Keep answers under 300 words unless the user asks for detail.
If you don't know something, say so.
If a user asks you to perform an action that requires a disabled permission, explain what you can't do and suggest they enable it in Bot Manager.
Panel context includes a status (focused/active/background) and content level (full/summary/title-only).
The focused panel is what the user is currently looking at — prioritize it.
When context is at summary or title-only level, use desk_read_file to get full content if needed.
</instructions>`;

const SCOPE_DESCRIPTIONS: Record<DeskToolScope, string> = {
	'desk:read': 'read: List files, read contents, search workspace',
	'desk:write': 'write: Update spreadsheet cells, update markdown content, rename files',
	'desk:create': 'create: Create new spreadsheets and documents',
	'desk:delete': 'delete: Delete files (requires user confirmation per action)',
};

/** Build a <permissions> block listing which tool scopes are enabled/disabled. */
export function buildPermissionsBlock(scopes: DeskToolScope[]): string {
	const lines = (['desk:read', 'desk:write', 'desk:create', 'desk:delete'] as const).map(
		(s) => `- ${SCOPE_DESCRIPTIONS[s]} [${scopes.includes(s) ? 'enabled' : 'disabled'}]`,
	);
	return `<permissions>\n${lines.join('\n')}\n</permissions>`;
}

/**
 * <completion> guidance — mitigates AI SDK #8544 (stopWhen is a no-op when the model
 * emits zero tool calls) by telling the model explicitly when it may stop. Also
 * nudges it to continue executing an approved plan rather than emitting a final
 * response mid-plan.
 *
 * Always inject when tools are registered.
 */
export const COMPLETION_BLOCK = `<completion>
You may stop calling tools when the user's request is fully satisfied.
If you have more planned steps from an approved plan, continue executing them before emitting your final response.
</completion>`;

/**
 * <planning> guidance — injected only when `shouldRequirePlan` fires (destructive
 * multi-step batch). Uses conditional phrasing because the common-case one-shot
 * interaction must NOT plan first.
 *
 * See `shouldRequirePlan` in `src/lib/server/ai/policy/governor.ts`.
 */
export const PLANNING_BLOCK = `<planning>
Before any step that writes, deletes, or modifies more than one desk item,
call desk_propose_plan first with the full sequence you intend to execute.

Do NOT call desk_propose_plan for:
- Single-tool read operations (desk_list_files, desk_read_file, desk_file_tree, desk_search_files, desk_get_open_panels)
- Single-target destructive actions (desk_delete_file already has its own two-phase confirmation)
- Answering questions from retrieved context or desk-context alone
- Acknowledgements or clarifications

If the user has already approved a plan in this conversation and you are executing a step from it, proceed directly — do not re-plan.
</planning>`;
