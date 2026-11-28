/**
 * The query contract every registry tool answers under — the tool definition shape, the outcome
 * and failure-recovery convention, and the argument bound — on its own so that `query.ts` and the
 * tools it composes (the dependency explorer, Architecture Engineering) share it without an
 * import cycle. Framework-free and filesystem-free.
 */

/** MCP tools/list shape — name/description/inputSchema ONLY: `outputSchema`, `title` or
 *  `annotations` on any one tool made Claude Code silently drop the server's whole tool list. */
export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/**
 * A concrete next step handed to the caller on every error (the "self-reflective API" pattern:
 * agents recover measurably better from a named next call than from prose alone).
 *
 * `args` values are ALWAYS literals this module wrote — never caller text. The bounded-echo
 * discipline (get_pattern's id reflection) is the ceiling; this block adds no echo surface.
 */
export interface NextAction {
	tool: string;
	args?: Record<string, string | number | boolean | readonly string[]>;
	why: string;
}

export const NEXT_ACTIONS_HEADING = '## Next actions';
export const MAX_NEXT_ACTIONS = 3;

/**
 * Renders the trailer as TEXT inside the body — not a structured field: results are text-only
 * by hard-won convention (structuredContent makes Claude Code hide the text body), and a fixed
 * heading is exactly as machine-parsable while staying visible. Never throws; an empty array
 * returns the body unchanged.
 */
export function withNextActions(body: string, actions: readonly NextAction[]): string {
	if (actions.length === 0) return body;
	const lines = actions.slice(0, MAX_NEXT_ACTIONS).map((action, index) => {
		const args = action.args ? ` ${JSON.stringify(action.args)}` : '';
		return `${index + 1}. \`${action.tool}\`${args} — ${action.why}`;
	});
	return `${body}\n\n${NEXT_ACTIONS_HEADING}\n${lines.join('\n')}`;
}

/** Why a query failed. A subset of the hosted `ToolDiag`, which carries it into telemetry. */
export type QueryDiag = 'empty' | 'invalid_args' | 'not_found';

export type QueryOutcome =
	| { ok: true; text: string }
	| { ok: false; text: string; diag: QueryDiag; next: readonly NextAction[] };

/** Longest string argument any registry tool accepts. */
export const MAX_ARG_CHARS = 512;
