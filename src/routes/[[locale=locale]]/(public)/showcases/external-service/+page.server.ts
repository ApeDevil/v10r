import { fail } from '@sveltejs/kit';
import { checkHoneypot, ipLimitKey } from '$lib/server/abuse';
import { getClientIp } from '$lib/server/http/client-ip';
import { startDeadline } from '$lib/server/http/deadline';
import { createLimiter } from '$lib/server/http/rate-limit';
import {
	CALL_CEILING_MS,
	checkTarget,
	evaluatePreset,
	GLOBAL_RATE_LIMIT_MAX,
	GLOBAL_RATE_LIMIT_PREFIX,
	GLOBAL_WAKE_RATE_LIMIT_MAX,
	GLOBAL_WAKE_RATE_LIMIT_PREFIX,
	LAB_LIMITER_POLICY,
	RATE_LIMIT_MAX,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	RENDER_RESERVE_MS,
	readServiceTargets,
	runDrill,
	WAKE_CEILING_MS,
	WAKE_RATE_LIMIT_MAX,
	WAKE_RATE_LIMIT_PREFIX,
} from '$lib/server/showcases/external-service';
import { externalServiceCopy } from '$lib/showcases/external-service/labels';
import {
	CHECK_PATIENCE,
	type CheckPatience,
	EVALUATION_PRESET_IDS,
	type EvaluationPresetId,
	type LabRejection,
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
 * behind the honeypot, a per-IP and a global limiter (and, for a wake check, two smaller
 * ones of its own), each with a sub-budget of the request deadline. The form carries ids from closed lists (target, preset, drill,
 * patience), never a URL or a body.
 */

/** Room for a `wake` check (WAKE_CEILING_MS) plus rendering; Vercel's own ceiling is 300 s. */
export const config = { maxDuration: 90 };

const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, LAB_LIMITER_POLICY);
const globalLimiter = createLimiter(
	GLOBAL_RATE_LIMIT_PREFIX,
	GLOBAL_RATE_LIMIT_MAX,
	RATE_LIMIT_WINDOW,
	LAB_LIMITER_POLICY,
);
const wakeLimiter = createLimiter(WAKE_RATE_LIMIT_PREFIX, WAKE_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, LAB_LIMITER_POLICY);
const globalWakeLimiter = createLimiter(
	GLOBAL_WAKE_RATE_LIMIT_PREFIX,
	GLOBAL_WAKE_RATE_LIMIT_MAX,
	RATE_LIMIT_WINDOW,
	LAB_LIMITER_POLICY,
);
const GLOBAL_KEY = 'all';

export const load: PageServerLoad = async () => {
	const targets = readServiceTargets();
	return {
		title: 'External Service Lab - Showcases',
		// Resolved here, in the request's locale: the client gets strings, not three dictionaries.
		copy: externalServiceCopy(),
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

/** `renderedAt` as a number only when it is one: `Number(null)` and `Number('')` are 0, which passes the speed check. */
function renderedAt(form: FormData): number {
	const value = form.get('renderedAt');
	return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

const reject = (status: number, rejected: LabRejection) => ({ rejected: fail(status, { rejected }) });

/** Shared gate for every action: closed-list target, honeypot, then the limiters. */
async function admit(event: RequestEvent) {
	const form = await event.request.formData();
	const target = pick<ServiceTargetId>(form, 'target', SERVICE_TARGET_IDS);
	if (!target) return reject(400, 'invalid');

	const bookmark = form.get('bookmark');
	const honeypot = checkHoneypot({
		honeypot: typeof bookmark === 'string' ? bookmark : null,
		renderedAt: renderedAt(form),
	});
	// Generic on purpose: it does not teach a bot which check fired.
	if (!honeypot.allowed) return reject(400, 'rejected');

	const perIp = await limiter.limit(ipLimitKey(getClientIp(event)));
	if (!perIp.success) return reject(429, 'rate_limited');
	const overall = await globalLimiter.limit(GLOBAL_KEY);
	if (!overall.success) return reject(429, 'rate_limited');

	return {
		form,
		resolved: readServiceTargets()[target],
		deps: { deadline: event.locals.deadline.child(CALL_CEILING_MS, { reserveMs: RENDER_RESERVE_MS }) },
	};
}

/** Each call's client-side figures become spans in this request's own trace. */
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
		if ('rejected' in admitted) return admitted.rejected;
		const patience = pick<CheckPatience>(admitted.form, 'patience', CHECK_PATIENCE) ?? 'normal';
		if (patience === 'wake') {
			const perIp = await wakeLimiter.limit(ipLimitKey(getClientIp(event)));
			if (!perIp.success) return fail(429, { rejected: 'rate_limited' as LabRejection });
			const overall = await globalWakeLimiter.limit(GLOBAL_KEY);
			if (!overall.success) return fail(429, { rejected: 'rate_limited' as LabRejection });
		}
		// A wake check gets its own wider deadline: the request's 10 s budget cannot hold a
		// cold start, and observing one is the point.
		const deps = patience === 'wake' ? { deadline: startDeadline(WAKE_CEILING_MS) } : admitted.deps;
		const check = await checkTarget(admitted.resolved, deps);
		recordSpans(event, [check.live, check.status]);
		return { kind: 'check' as const, patience, check };
	},

	evaluate: async (event) => {
		const admitted = await admit(event);
		if ('rejected' in admitted) return admitted.rejected;
		const preset = pick<EvaluationPresetId>(admitted.form, 'preset', EVALUATION_PRESET_IDS);
		if (!preset) return fail(400, { rejected: 'invalid' as LabRejection });
		const call = await evaluatePreset(admitted.resolved, preset, admitted.deps);
		recordSpans(event, [call]);
		return { kind: 'evaluate' as const, preset, call };
	},

	drill: async (event) => {
		const admitted = await admit(event);
		if ('rejected' in admitted) return admitted.rejected;
		const drill = pick<ServiceDrillId>(admitted.form, 'drill', SERVICE_DRILL_IDS);
		if (!drill) return fail(400, { rejected: 'invalid' as LabRejection });
		const call = await runDrill(admitted.resolved, drill, admitted.deps);
		recordSpans(event, [call]);
		return { kind: 'drill' as const, drill, call };
	},
};
