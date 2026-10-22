import { fail } from '@sveltejs/kit';
import { checkHoneypot, ipLimitKey } from '$lib/server/abuse';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter } from '$lib/server/http/rate-limit';
import {
	CALL_CEILING_MS,
	checkTarget,
	evaluateScenario,
	RATE_LIMIT_MAX,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	RENDER_RESERVE_MS,
	readServiceTargets,
	runDrill,
} from '$lib/server/showcases/external-service';
import {
	EVALUATION_SCENARIO_IDS,
	type EvaluationScenarioId,
	type PublicServiceCall,
	SERVICE_DRILL_IDS,
	SERVICE_TARGET_IDS,
	type ServiceDrillId,
	type ServiceTargetId,
} from '$lib/showcases/external-service/types';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/**
 * External Service Lab — the route adapter.
 *
 * `load` reports only what the server knows without calling anything: which targets are
 * configured. A page view never reaches the service — otherwise every crawler visit would
 * be an outbound call and would wake a sleeping free host. Calls happen in the actions,
 * behind the honeypot and an IP limiter, each with a sub-budget of the request deadline.
 * The form carries ids from closed lists (target, scenario, drill), never a URL or a body.
 */
const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const load: PageServerLoad = async () => {
	const targets = readServiceTargets();
	return {
		title: 'External Service Lab - Showcases',
		renderedAt: Date.now(),
		targets: SERVICE_TARGET_IDS.map((id) => {
			const resolved = targets[id];
			return {
				id,
				setup: resolved.setup,
				problem: resolved.setup === 'misconfigured' ? resolved.problem : null,
			};
		}),
	};
};

function pick<T extends string>(form: FormData, field: string, allowed: readonly T[]): T | null {
	const value = form.get(field);
	return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Shared gate for every action: closed-list target, honeypot, then the IP limiter. */
async function admit(event: RequestEvent) {
	const form = await event.request.formData();
	const target = pick<ServiceTargetId>(form, 'target', SERVICE_TARGET_IDS);
	if (!target) return { refused: fail(400, { refused: 'invalid' as const }) };

	const bookmark = form.get('bookmark');
	const honeypot = checkHoneypot({
		honeypot: typeof bookmark === 'string' ? bookmark : null,
		renderedAt: Number(form.get('renderedAt')),
	});
	// Generic on purpose: it does not teach a bot which check fired.
	if (!honeypot.allowed) return { refused: fail(400, { refused: 'rejected' as const }) };

	const { success } = await limiter.limit(ipLimitKey(getClientIp(event)));
	if (!success) return { refused: fail(429, { refused: 'rate_limited' as const }) };

	return {
		form,
		resolved: readServiceTargets()[target],
		deps: { deadline: event.locals.deadline.child(CALL_CEILING_MS, { reserveMs: RENDER_RESERVE_MS }) },
	};
}

/** Each call's adapter-side figures become spans in this request's own trace. */
function recordSpans(event: RequestEvent, calls: Array<PublicServiceCall | null>) {
	for (const call of calls) {
		if (!call?.timing) continue;
		event.locals.timing.record(`ext_${call.operation}`, call.timing.totalMs);
		if (call.timing.serviceMs !== null) event.locals.timing.record(`ext_${call.operation}_app`, call.timing.serviceMs);
	}
}

export const actions: Actions = {
	check: async (event) => {
		const admitted = await admit(event);
		if ('refused' in admitted) return admitted.refused;
		const check = await checkTarget(admitted.resolved, admitted.deps);
		recordSpans(event, [check.live, check.status]);
		return { kind: 'check' as const, check };
	},

	evaluate: async (event) => {
		const admitted = await admit(event);
		if ('refused' in admitted) return admitted.refused;
		const scenario = pick<EvaluationScenarioId>(admitted.form, 'scenario', EVALUATION_SCENARIO_IDS);
		if (!scenario) return fail(400, { refused: 'invalid' as const });
		const call = await evaluateScenario(admitted.resolved, scenario, admitted.deps);
		recordSpans(event, [call]);
		return { kind: 'evaluate' as const, scenario, call };
	},

	drill: async (event) => {
		const admitted = await admit(event);
		if ('refused' in admitted) return admitted.refused;
		const drill = pick<ServiceDrillId>(admitted.form, 'drill', SERVICE_DRILL_IDS);
		if (!drill) return fail(400, { refused: 'invalid' as const });
		const call = await runDrill(admitted.resolved, drill, admitted.deps);
		recordSpans(event, [call]);
		return { kind: 'drill' as const, drill, call };
	},
};
