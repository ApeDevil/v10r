/**
 * The PRIVATE admin tool registry: a narrow allowlist of demo-state tools exposed only by the
 * authenticated `/api/mcp/admin` endpoint. There is no generic SQL / filesystem / shell / fetch
 * / arbitrary-key tool here — only these five, each delegating to the demo-state domain service
 * so the business rules are shared with the admin page and never duplicated in a route handler.
 */
import { buildInfo } from '../server-info';
import {
	errorResult,
	type NextAction,
	type ToolDef,
	type ToolDiag,
	type ToolRegistry,
	type ToolResult,
	textResult,
} from '../types';
import { DEMO_COLORS } from './constants';
import {
	type DemoActor,
	type DemoStateView,
	getDemoHistory,
	getDemoState,
	type HistoryEntry,
	resetDemoState,
	type SetStateResult,
	setDemoColor,
	setDemoMessage,
} from './service';

/** Fixed machine identity for changes made through the admin MCP. */
export const ADMIN_MCP_ACTOR: DemoActor = {
	id: 'admin-mcp',
	email: 'admin-mcp@velociraptor.local',
	label: 'admin-mcp',
};

export const ADMIN_STATE_TOOLS: ToolDef[] = [
	{
		name: 'get_mcp_page_state',
		description: 'Read the current MCP demo state (message, color, version, timestamp, updater) shown on /admin/mcp.',
		inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	},
	{
		name: 'set_mcp_page_message',
		description:
			'Set the plain-text message shown on /admin/mcp. Rejects empty or over-500-character input. Increments the version.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				message: { type: 'string', minLength: 1, maxLength: 500, description: 'Plain-text message (1-500 chars).' },
			},
			required: ['message'],
		},
	},
	{
		name: 'set_mcp_page_color',
		description: `Set the color box shown on /admin/mcp. Must be one of: ${DEMO_COLORS.join(', ')}. Increments the version.`,
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				color: {
					type: 'string',
					enum: [...DEMO_COLORS],
					description: `Semantic color name (${DEMO_COLORS.join(' | ')}).`,
				},
			},
			required: ['color'],
		},
	},
	{
		name: 'reset_mcp_page_state',
		description:
			'Reset the message and color back to their seed values ("Hello, Velociraptor." / blue). Increments the version.',
		inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	},
	{
		name: 'get_mcp_page_history',
		description:
			'Read the most recent demo-state changes (from the admin audit log) with actor and before/after values.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			properties: {
				limit: {
					type: 'integer',
					minimum: 1,
					maximum: 50,
					default: 10,
					description: 'Max entries (1-50). Default 10.',
				},
			},
		},
	},
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The demo service already reports WHY it refused, out-of-band, via `code`. Mapping that onto the
 * telemetry vocabulary AND a recovery step keeps one source of truth instead of re-deriving the
 * reason from the human-readable message.
 *
 * `conflict` is deliberately not folded into `invalid_args`: losing an optimistic-concurrency race
 * on a singleton row is neither a client bug nor a crash, and on a surface with one authorised
 * caller a non-zero count means either two operators or a runaway loop — both worth seeing.
 *
 * The `never` arm makes a newly-added service code a compile error rather than a silent default.
 */
function adviceFor(code: 'invalid_message' | 'invalid_color' | 'conflict'): {
	diag: ToolDiag;
	next: readonly NextAction[];
} {
	switch (code) {
		case 'invalid_message':
		case 'invalid_color':
			return {
				diag: 'invalid_args',
				next: [{ tool: 'get_mcp_page_state', why: 'shows the current values and the accepted shape.' }],
			};
		case 'conflict':
			return {
				diag: 'conflict',
				next: [{ tool: 'get_mcp_page_state', why: 'read the winning version, then retry the write once.' }],
			};
		default: {
			const exhaustive: never = code;
			return exhaustive;
		}
	}
}

/** Bridge a refused service result to an error result carrying both the diag and the recovery step. */
function serviceError(message: string, code: 'invalid_message' | 'invalid_color' | 'conflict'): ToolResult {
	const advice = adviceFor(code);
	return errorResult(message, advice.diag, advice.next);
}

function stateBlock(state: DemoStateView): string {
	const build = buildInfo();
	return [
		`- message: ${JSON.stringify(state.message)}`,
		`- color: ${state.color}`,
		`- version: ${state.version}`,
		`- updatedAt: ${state.updatedAt}`,
		`- updatedBy: ${state.updatedBy ?? '(unset)'}`,
		`- build: app ${build.app} · registry ${build.patternRegistry} · commit ${build.commit} · env ${build.environment}`,
	].join('\n');
}

function renderState(state: DemoStateView): string {
	return `# MCP demo state\n${stateBlock(state)}`;
}

function renderMutation(result: Extract<SetStateResult, { ok: true }>): string {
	const { before, after, field } = result;
	const lines = [`# MCP demo state updated (${field})`, `version: ${before.version} → ${after.version}`];
	if (before.message !== after.message) {
		lines.push(`message: ${JSON.stringify(before.message)} → ${JSON.stringify(after.message)}`);
	}
	if (before.color !== after.color) {
		lines.push(`color: ${before.color} → ${after.color}`);
	}
	lines.push('', '## Resulting state', stateBlock(after));
	return lines.join('\n');
}

function snapshotLabel(s: { message: string | null; color: string | null; version: number | null }): string {
	return (
		`v${s.version ?? '?'}` +
		`${s.message !== null ? ` message=${JSON.stringify(s.message)}` : ''}` +
		`${s.color !== null ? ` color=${s.color}` : ''}`
	);
}

function renderHistory(entries: HistoryEntry[]): string {
	if (entries.length === 0) return 'No demo-state changes recorded yet.';
	const rows = entries.map(
		(entry) =>
			`- [${entry.occurredAt}] ${entry.field} by ${entry.actor}: ${snapshotLabel(entry.before)} → ${snapshotLabel(entry.after)}`,
	);
	return `# MCP demo-state history (${entries.length})\n${rows.join('\n')}`;
}

/**
 * Build the admin registry bound to a given actor (the endpoint injects the request IP).
 * Defaults to the machine identity so the registry is usable standalone in tests.
 */
export function createAdminStateRegistry(actor: DemoActor = ADMIN_MCP_ACTOR): ToolRegistry {
	async function dispatch(name: string, rawArgs: unknown): Promise<ToolResult> {
		const args = isRecord(rawArgs) ? rawArgs : {};
		switch (name) {
			case 'get_mcp_page_state':
				return textResult(renderState(await getDemoState()));
			case 'set_mcp_page_message': {
				const result = await setDemoMessage(args.message, actor);
				return result.ok ? textResult(renderMutation(result)) : serviceError(result.message, result.code);
			}
			case 'set_mcp_page_color': {
				const result = await setDemoColor(args.color, actor);
				return result.ok ? textResult(renderMutation(result)) : serviceError(result.message, result.code);
			}
			case 'reset_mcp_page_state': {
				const result = await resetDemoState(actor);
				return result.ok
					? textResult(renderMutation({ ok: true, field: 'reset', before: result.before, after: result.after }))
					: serviceError(result.message, result.code);
			}
			case 'get_mcp_page_history': {
				const limit = typeof args.limit === 'number' ? args.limit : 10;
				return textResult(renderHistory(await getDemoHistory(limit)));
			}
			default:
				return errorResult(
					`Unknown tool "${name}". Available: ${ADMIN_STATE_TOOLS.map((tool) => tool.name).join(', ')}.`,
					'unknown_tool',
					[{ tool: 'get_mcp_page_state', why: 'the read entry point for this surface.' }],
				);
		}
	}
	return { tools: ADMIN_STATE_TOOLS, dispatch };
}

/** Default admin registry (machine actor, no request IP). */
export const adminStateRegistry: ToolRegistry = createAdminStateRegistry();

export const ADMIN_MCP_INSTRUCTIONS =
	'Authenticated admin control surface for the v10r MCP demo state shown on /admin/mcp. get_mcp_page_state to read; set_mcp_page_message / set_mcp_page_color to change the two visible values; reset_mcp_page_state to restore seed values; get_mcp_page_history for recent changes. Every write is validated and versioned, and is audited on a best-effort basis (an audit failure is logged but does not roll back the change). No other capabilities are exposed.';
