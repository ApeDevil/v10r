/**
 * Governor — the policy layer.
 *
 * Three complementary seams:
 *
 * 1. **Pre-stream gate** (`resolveEffectivePolicy`) — called from the
 *    orchestrator before `buildSystemPrompt`. Intersects the client's
 *    requested scopes with the server-side ceiling derived from the
 *    user's role. The model only ever sees tools the governor permits.
 *
 * 2. **Factory filter** — `createDeskTools(userId, scopes)` in
 *    `tools/index.ts` is already the load-bearing seam: it omits tools
 *    for scopes the governor didn't grant. Schema-level enforcement
 *    means violations are impossible, not just checked.
 *
 * 3. **Per-execute wrapper** (`withGovernor`) — runtime assertion for
 *    arg-dependent risk. Same tool, different risk per input: e.g.
 *    `desk_update_cells` targeting the user's own spreadsheet is
 *    tier-1, targeting a shared workspace is tier-3. Only this seam
 *    can catch arg-dependent escalation.
 *
 * Wrap order (set in `policy/sensor.ts`): `withGovernor(withSensor(execute))`.
 * Governor outside — blocked calls never reach the sensor, which is correct:
 * blocked calls are a policy audit concern, not a sensor-trace concern.
 */
import type { DeskToolMeta, DeskToolScope } from '$lib/server/ai/tools/_types';
import type { PolicyError } from './errors';

/** Result of resolving the effective policy for a request. */
export interface EffectivePolicy {
	/** Scopes actually granted (client ∩ server ceiling). */
	scopes: DeskToolScope[];
	/** Maximum tool calls allowed per turn. Feeds `stopWhen: stepCountIs`. */
	maxStepsPerTurn: number;
	/** Daily tool-call budget, or `undefined` for unlimited. */
	dailyToolBudget?: number;
}

/** Input to `resolveEffectivePolicy`. Pre-stream, per-request. */
export interface PolicyInput {
	userId: string;
	/** Scopes the client requested (from `bot-config.svelte.ts`). */
	requestedScopes: DeskToolScope[];
	/** Governor config the user's role/subscription permits. Prefetched in `+layout.server.ts`. */
	ceiling?: {
		permittedScopes: DeskToolScope[];
		dailyToolBudget?: number;
	};
}

/**
 * Resolve the effective policy by intersecting the client floor with the
 * server ceiling. The server decides what the user's role *allows*; the
 * client decides what the user wants *enabled*. The policy is the overlap.
 *
 * When no ceiling is provided (no role-based restriction active),
 * everything the client requested is allowed.
 */
export function resolveEffectivePolicy(input: PolicyInput): EffectivePolicy {
	const ceiling = input.ceiling?.permittedScopes;
	const scopes = ceiling ? input.requestedScopes.filter((s) => ceiling.includes(s)) : [...input.requestedScopes];

	return {
		scopes,
		// Read-only caps at 3, anything mutating at 5 — matches `stepsForScopes` in tools/index.ts.
		maxStepsPerTurn: scopes.some((s) => s !== 'desk:read') ? 5 : 3,
		dailyToolBudget: input.ceiling?.dailyToolBudget,
	};
}

/**
 * Wrap a tool's `execute` with an arg-dependent runtime check.
 *
 * The `check` function receives the tool's input and can return `null`
 * to allow the call, or a `PolicyError` to block it. Blocked calls never
 * invoke the inner `execute`; the model sees `{ error: toModelView(...) }`.
 *
 * Stub for now — Phase E wires up real policy checks when the
 * `agent_audit_log` sink is plumbed. The shape is frozen so downstream
 * code can target it.
 */
export function withGovernor<TInput, TOutput>(
	_toolName: string,
	_meta: DeskToolMeta,
	check: (input: TInput) => PolicyError | null,
	execute: (input: TInput, ctx: unknown) => Promise<TOutput>,
): (input: TInput, ctx: unknown) => Promise<TOutput | { error: unknown }> {
	return async (input: TInput, ctx: unknown) => {
		const denial = check(input);
		if (denial) {
			// Model-facing view — minimum leak, recovery-critical fields only.
			const { toModelView } = await import('./errors');
			return { error: toModelView(denial) };
		}
		return execute(input, ctx);
	};
}

/**
 * Narrow predicate for plan-before-execute.
 *
 * Plan-first is **not** the default posture. It's a latency tax on one-shot
 * interactions, so it only kicks in when ALL THREE conditions hold:
 *
 *  (a) destructive-intent heuristic fires on the last user message
 *  (b) ≥2 tools with `risk: 'destructive'` are registered for this request
 *  (c) ≥2 distinct target entities are inferred from panel context
 *
 * Single destructive actions keep their existing two-phase `confirmed: boolean`
 * pattern (see `desk_delete_file` in `tools/desk-create.ts`).
 */
export interface PlanPredicateInput {
	lastUserMessage: string;
	toolRisks: Array<DeskToolMeta['risk']>;
	panelContextCount: number;
}

const DESTRUCTIVE_INTENT_PATTERN = /\b(delete|remove|drop|trash|purge|clear|wipe|erase|destroy)\b/i;

export function shouldRequirePlan(input: PlanPredicateInput): boolean {
	// (a) destructive intent heuristic — cheap regex; Haiku call is a follow-up.
	if (!DESTRUCTIVE_INTENT_PATTERN.test(input.lastUserMessage)) return false;

	// (b) at least two destructive tools registered.
	const destructiveCount = input.toolRisks.filter((r) => r === 'destructive').length;
	if (destructiveCount < 2) return false;

	// (c) at least two distinct targets inferred from panel context.
	if (input.panelContextCount < 2) return false;

	return true;
}
