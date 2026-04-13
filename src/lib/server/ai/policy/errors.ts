/**
 * Structured policy errors with three visibility surfaces.
 *
 * One source type (`PolicyError`) renders into three views via the
 * `toModelView` / `toClientView` / `toAuditView` helpers:
 *
 * - **model**: what the LLM sees in its tool-result. Minimum leak — only
 *   recovery-critical fields (`code`, `hint`, `retryable`). No policy
 *   names, no internal IDs, no raw args. Prompt-injection-safe.
 * - **client**: what the frontend renders as a "blocked" indicator in
 *   the chat stream. Includes the human-readable message and policy
 *   name so users can understand why an action was blocked.
 * - **audit**: what the `agent_audit_log` table stores. Full envelope
 *   including raw args, evidence, governor decision metadata.
 *
 * Rule: anything the model needs to recover goes in the model view.
 * Anything the model would be confused or biased by (latency, rule
 * names, internal IDs) stays sidecar.
 */

/** Stable policy error codes. Add new ones here; the enum drives telemetry grouping. */
export type PolicyErrorCode =
	| 'policy_denied'
	| 'policy_requires_approval'
	| 'policy_rate_limited'
	| 'policy_scope_missing'
	| 'policy_quota_exceeded';

/** The one source of truth. Narrow views are derived from this. */
export interface PolicyError {
	code: PolicyErrorCode;
	/** Internal policy rule name, e.g. `desk.write.cross-workspace`. Not shown to the model. */
	policyName: string;
	/** Machine-readable reason, e.g. `workspace_id_mismatch`. */
	reason: string;
	/** One-sentence message for end users. */
	humanMessage: string;
	/** Whether a retry with different inputs could succeed. `false` halts blind retry loops. */
	retryable: boolean;
	/** Suggested wait before retry (for rate-limited cases). */
	retryAfterMs?: number;
	/** Evidence the policy saw (IDs only, never contents). Audit-only. */
	evidence?: Record<string, unknown>;
}

/** Model-facing view. Used as the `error` field in tool results so the model can reason about recovery. */
export interface PolicyErrorModelView {
	code: PolicyErrorCode;
	hint: string;
	retryable: boolean;
	retryAfterMs?: number;
}

/** Client-facing view. Rendered in the chat UI as a "blocked" indicator. */
export interface PolicyErrorClientView {
	code: PolicyErrorCode;
	policyName: string;
	humanMessage: string;
	retryable: boolean;
	retryAfterMs?: number;
}

/** Audit-trail view. Full envelope including evidence; written to `agent_audit_log`. */
export interface PolicyErrorAuditView extends PolicyError {
	/** ISO timestamp when the decision was made. */
	decidedAt: string;
}

/** Project a `PolicyError` into the minimum the model needs to recover. */
export function toModelView(err: PolicyError): PolicyErrorModelView {
	return {
		code: err.code,
		hint: err.humanMessage,
		retryable: err.retryable,
		...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {}),
	};
}

/** Project a `PolicyError` into the client/UI view. Includes policy name for user-facing explanation. */
export function toClientView(err: PolicyError): PolicyErrorClientView {
	return {
		code: err.code,
		policyName: err.policyName,
		humanMessage: err.humanMessage,
		retryable: err.retryable,
		...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {}),
	};
}

/** Project a `PolicyError` into the audit-log view. Full envelope plus timestamp. */
export function toAuditView(err: PolicyError): PolicyErrorAuditView {
	return { ...err, decidedAt: new Date().toISOString() };
}

/** Construct a standard scope-denied error for a given tool. */
export function scopeDenied(toolName: string, scope: string): PolicyError {
	return {
		code: 'policy_scope_missing',
		policyName: `scope.${scope}`,
		reason: 'scope_not_granted',
		humanMessage: `The ${scope} permission is required to run ${toolName}. Enable it in Bot Manager and try again.`,
		retryable: false,
	};
}
