/**
 * What the External Service Lab does, as framework-free functions the route actions call.
 *
 * Each returns `PublicServiceCall`s — the projection the page may see — so the route
 * adapter only parses the form, applies the rate limit and records timing spans.
 */
import type { Deadline } from '$lib/server/http/deadline';
import type {
	EvaluationScenarioId,
	OrderEvaluation,
	PublicServiceCall,
	ServiceDrillId,
	ServiceLiveness,
	ServiceOperationName,
	ServiceStatus,
	ServiceTargetId,
} from '$lib/showcases/external-service/types';
import { callService, SERVICE_OPERATIONS, type ServiceCall } from './client';
import { DRILL_DEADLINE_MS } from './config';
import { EVALUATION_SCENARIOS, UNVALIDATED_DRILL_REQUEST, WRONG_CREDENTIAL } from './scenarios';
import type { ResolvedServiceTarget } from './targets';

export interface LabCallDeps {
	deadline: Deadline;
	fetch?: typeof fetch;
}

const SETUP_MESSAGES = {
	unconfigured: 'This target is not configured on this deployment.',
	incomplete: 'Only one of URL and credential is set.',
	invalid_url: 'The configured URL is not a valid http(s) URL.',
	not_an_origin: 'The configured URL must be an origin only — no path, query or credentials.',
	insecure_url: 'The remote target must use https.',
	short_token: 'The configured credential is shorter than 32 characters.',
} as const;

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

/** A call that was never made, because the target is not usable. */
function setupRefusal<T>(resolved: ResolvedServiceTarget, operation: ServiceOperationName): PublicServiceCall<T> {
	const message = resolved.setup === 'misconfigured' ? SETUP_MESSAGES[resolved.problem] : SETUP_MESSAGES.unconfigured;
	return {
		target: resolved.id,
		operation,
		outcome: resolved.setup === 'misconfigured' ? 'misconfigured' : 'unconfigured',
		httpStatus: null,
		message,
		requestId: null,
		timing: null,
		data: null,
		measuredAt: new Date().toISOString(),
	};
}

export interface TargetCheck {
	live: PublicServiceCall<ServiceLiveness>;
	/** Not attempted when liveness failed: an unanswered target cannot authenticate. */
	status: PublicServiceCall<ServiceStatus> | null;
}

/**
 * Liveness (public) then status (authenticated), sharing one deadline. Two calls on
 * purpose: "it is up" and "we may use it" are different facts, and the second proves the
 * credential works.
 */
export async function checkTarget(resolved: ResolvedServiceTarget, deps: LabCallDeps): Promise<TargetCheck> {
	if (resolved.setup !== 'configured') {
		return { live: setupRefusal(resolved, 'live'), status: null };
	}
	const { target } = resolved;
	const live = toPublicServiceCall(
		target.id,
		'live',
		await callService(target, SERVICE_OPERATIONS.live, undefined, deps),
	);
	if (live.outcome !== 'ok') return { live, status: null };
	const status = toPublicServiceCall(
		target.id,
		'status',
		await callService(target, SERVICE_OPERATIONS.status, undefined, deps),
	);
	return { live, status };
}

export async function evaluateScenario(
	resolved: ResolvedServiceTarget,
	scenario: EvaluationScenarioId,
	deps: LabCallDeps,
): Promise<PublicServiceCall<OrderEvaluation>> {
	if (resolved.setup !== 'configured') return setupRefusal(resolved, 'evaluate');
	const call = await callService(resolved.target, SERVICE_OPERATIONS.evaluate, EVALUATION_SCENARIOS[scenario], deps);
	return toPublicServiceCall(resolved.id, 'evaluate', call);
}

/**
 * A deliberate failure, made real: one thing changes on the caller's side and the
 * service's genuine response to it is reported. There is nothing to switch on in the
 * service — it has no fault-injection controls, on any host.
 */
export async function runDrill(
	resolved: ResolvedServiceTarget,
	drill: ServiceDrillId,
	deps: LabCallDeps,
): Promise<PublicServiceCall> {
	if (resolved.setup !== 'configured') return setupRefusal(resolved, 'evaluate');
	const { target } = resolved;
	const evaluate = SERVICE_OPERATIONS.evaluate;
	const request = EVALUATION_SCENARIOS.fulfilled;

	let call: ServiceCall<unknown>;
	switch (drill) {
		case 'deadline':
			call = await callService(target, evaluate, request, {
				...deps,
				deadline: deps.deadline.child(DRILL_DEADLINE_MS),
			});
			break;
		case 'credential':
			call = await callService(target, evaluate, request, { ...deps, token: WRONG_CREDENTIAL });
			break;
		case 'unvalidated':
			call = await callService(target, evaluate, UNVALIDATED_DRILL_REQUEST, { ...deps, validateRequest: false });
			break;
	}
	return toPublicServiceCall(target.id, 'evaluate', call);
}
