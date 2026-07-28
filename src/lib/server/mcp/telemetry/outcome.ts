/**
 * Map one observed exchange onto the `mcp.call_log` stage/outcome pair.
 *
 * The interesting case is a tool that failed. `ToolResult.diag` says why — except for the two
 * errors the TRANSPORT builds itself, which deliberately carry no diag. That absence is the
 * discriminator:
 *
 *   isError && diag === undefined  ⟹  the transport produced this
 *       name not in registry.tools  →  unknown_tool
 *       otherwise                   →  threw
 *
 * The inference is TOTAL only because `errorResult`'s diag parameter is required. If a handler ever
 * returns `isError` without one, it lands in `tool_error` — which is not an outcome anyone should
 * see, but a COVERAGE METER: a non-zero count means an uninstrumented `errorResult` call site
 * exists. The schema tells you when the instrumentation has a hole.
 */
import type { McpCallObservation, ToolDiag } from '../types';

export type McpStage = 'gate' | 'envelope' | 'protocol' | 'tool';

export type McpOutcome =
	| 'ok'
	| 'empty'
	| 'invalid_args'
	| 'not_found'
	| 'snapshot_miss'
	| 'conflict'
	| 'unknown_tool'
	| 'threw'
	| 'tool_error'
	| 'unknown_method'
	| 'bad_envelope'
	| 'parse_error'
	| 'unsupported_version'
	| 'forbidden_origin'
	| 'rate_limited'
	| 'unauthorized'
	| 'unconfigured'
	| 'internal_error';

/** Reasons a request can be refused before the transport ever runs. */
export type McpGateReason = 'rate_limited' | 'unauthorized' | 'unconfigured';

/** Methods the transport implements. Anything else is caller-controlled text → 'other'. */
const KNOWN_METHODS = new Set([
	'initialize',
	'ping',
	'tools/list',
	'tools/call',
	'notification',
	'server/discover',
	'subscriptions/listen',
]);

export function normalizeMethod(method: string | null): string | null {
	if (method === null) return null;
	return KNOWN_METHODS.has(method) ? method : 'other';
}

/** Every ToolDiag maps to exactly one outcome. The `never` arm makes a new member a build error. */
function outcomeForDiag(diag: ToolDiag): McpOutcome {
	switch (diag) {
		case 'empty':
			return 'empty';
		case 'invalid_args':
			return 'invalid_args';
		case 'not_found':
			return 'not_found';
		case 'snapshot_miss':
			return 'snapshot_miss';
		case 'conflict':
			return 'conflict';
		case 'unknown_tool':
			return 'unknown_tool';
		default: {
			const exhaustive: never = diag;
			return exhaustive;
		}
	}
}

/**
 * Classify a request that reached the transport.
 *
 * `knownTool` distinguishes the transport's two bare errors and must be computed against the SAME
 * registry the transport dispatched from — passing a different registry would silently reclassify
 * every unknown-tool row as a crash.
 */
export function inferOutcome(
	observation: McpCallObservation,
	knownTool: (name: string) => boolean,
): { stage: McpStage; outcome: McpOutcome } {
	if (observation.stage === 'envelope') {
		if (observation.status === 403) return { stage: 'envelope', outcome: 'forbidden_origin' };
		if (observation.status === 500) return { stage: 'envelope', outcome: 'internal_error' };
		if (observation.rpcErrorCode === -32700) return { stage: 'envelope', outcome: 'parse_error' };
		if (observation.status === 400 && observation.rpcErrorCode === null) {
			return { stage: 'envelope', outcome: 'unsupported_version' };
		}
		return { stage: 'envelope', outcome: 'bad_envelope' };
	}

	if (observation.stage === 'protocol') {
		// -32601 is the transport's "method not found" — a spec-compliant client probing for a
		// capability this server does not expose. High-value: it is a feature request in disguise.
		if (observation.rpcErrorCode === -32601) return { stage: 'protocol', outcome: 'unknown_method' };
		if (observation.isError) return { stage: 'protocol', outcome: 'internal_error' };
		return { stage: 'protocol', outcome: 'ok' };
	}

	if (!observation.isError) return { stage: 'tool', outcome: 'ok' };
	if (observation.diag !== null) return { stage: 'tool', outcome: outcomeForDiag(observation.diag) };

	// No diag ⇒ the transport built this result, not a handler.
	const name = observation.toolName;
	if (name !== null && !knownTool(name)) return { stage: 'tool', outcome: 'unknown_tool' };
	return { stage: 'tool', outcome: 'threw' };
}
