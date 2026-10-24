/**
 * What the External Service Lab does, as framework-free functions the route actions call.
 *
 * Each returns `PublicServiceCall`s — the projection the page may see — so the route
 * adapter only parses the form, applies the rate limit and records timing spans.
 */
import type { Deadline } from '#lib/server/http/deadline.ts';
import { CONTRACT_RELEASE } from '#lib/showcases/external-service/contract.generated.ts';
import type {
	EvaluationPresetId,
	OrderEvaluation,
	PublicServiceCall,
	PublicTargetCheck,
	ServiceDrillId,
	ServiceOperationName,
	ServiceTargetId,
} from '#lib/showcases/external-service/types.ts';
import { callService, SERVICE_OPERATIONS, type ServiceCall } from './client';
import { DRILL_DEADLINE_MS } from './config';
import { contractSkew } from './contract-skew';
import { EVALUATION_PRESETS, UNVALIDATED_DRILL_REQUEST, WRONG_CREDENTIAL } from './presets';
import type { ResolvedServiceTarget } from './targets';

export interface LabCallDeps {
	deadline: Deadline;
	fetch?: typeof fetch;
}

/** The page-safe view of a call: no origin, no credential, no raw body. */
export function toPublicServiceCall<T>(
	target: ServiceTargetId,
	operation: ServiceOperationName,
	call: ServiceCall<T>,
): PublicServiceCall<T> {
	return {
		target,
		operation,
		outcome: call.ok ? 'ok' : call.kind,
		httpStatus: call.httpStatus,
		message: call.ok ? null : call.message,
		requestId: call.requestId,
		timing: call.timing,
		data: call.ok ? call.data : null,
		measuredAt: new Date().toISOString(),
	};
}

/**
 * A call that was never made, because the target is not usable. No message: the page
 * already states the target's setup — and the rule a misconfigured one broke — localized.
 */
function unattemptedCall<T>(resolved: ResolvedServiceTarget, operation: ServiceOperationName): PublicServiceCall<T> {
	return {
		target: resolved.id,
		operation,
		outcome: resolved.setup === 'misconfigured' ? 'misconfigured' : 'unconfigured',
		httpStatus: null,
		message: null,
		requestId: null,
		timing: null,
		data: null,
		measuredAt: new Date().toISOString(),
	};
}

/**
 * Liveness (public) then status (authenticated), sharing one deadline. Two calls on
 * purpose: "it is up" and "we may use it" are different facts, and the second proves the
 * credential works. Status is not attempted when liveness failed: an unanswered target
 * cannot authenticate. The status's `release` is then read against this app's contract
 * release — a diagnosis shown on the page, never a reason to refuse a call.
 */
export async function checkTarget(resolved: ResolvedServiceTarget, deps: LabCallDeps): Promise<PublicTargetCheck> {
	if (resolved.setup !== 'configured') {
		return { live: unattemptedCall(resolved, 'live'), status: null, contractSkew: null };
	}
	const { target } = resolved;
	const live = toPublicServiceCall(
		target.id,
		'live',
		await callService(target, SERVICE_OPERATIONS.live, undefined, deps),
	);
	if (live.outcome !== 'ok') return { live, status: null, contractSkew: null };
	const status = toPublicServiceCall(
		target.id,
		'status',
		await callService(target, SERVICE_OPERATIONS.status, undefined, deps),
	);
	// A status that answers off-contract is exactly when skew matters most, and its release
	// cannot be read: say `unknown` rather than nothing.
	const skew = status.data
		? contractSkew(status.data.release, CONTRACT_RELEASE)
		: status.outcome === 'malformed_response'
			? 'unknown'
			: null;
	return { live, status, contractSkew: skew };
}

export async function evaluatePreset(
	resolved: ResolvedServiceTarget,
	preset: EvaluationPresetId,
	deps: LabCallDeps,
): Promise<PublicServiceCall<OrderEvaluation>> {
	if (resolved.setup !== 'configured') return unattemptedCall(resolved, 'evaluate');
	const call = await callService(
		resolved.target,
		SERVICE_OPERATIONS.evaluate,
		EVALUATION_PRESETS[preset].request,
		deps,
	);
	return toPublicServiceCall(resolved.id, 'evaluate', call);
}

/**
 * A deliberate failure, made real: one thing changes on the caller's side and the
 * service's genuine response to it is reported. There is nothing to switch on in the
 * service — it has no fault-injection controls, on any host. Nor in the client: each drill
 * hands `callService` an ordinary value (a spent deadline, a different target, an
 * operation without a request schema), so the reference client carries no drill options.
 */
export async function runDrill(
	resolved: ResolvedServiceTarget,
	drill: ServiceDrillId,
	deps: LabCallDeps,
): Promise<PublicServiceCall> {
	if (resolved.setup !== 'configured') return unattemptedCall(resolved, 'evaluate');
	const { target } = resolved;
	const evaluate = SERVICE_OPERATIONS.evaluate;
	const request = EVALUATION_PRESETS.fulfilled.request;

	let call: ServiceCall<unknown>;
	switch (drill) {
		case 'deadline':
			call = await callService(target, evaluate, request, {
				...deps,
				deadline: deps.deadline.child(DRILL_DEADLINE_MS),
			});
			break;
		case 'credential':
			call = await callService({ ...target, token: WRONG_CREDENTIAL }, evaluate, request, deps);
			break;
		case 'unvalidated':
			call = await callService(target, { ...evaluate, requestSchema: null }, UNVALIDATED_DRILL_REQUEST, deps);
			break;
	}
	return toPublicServiceCall(target.id, 'evaluate', call);
}
