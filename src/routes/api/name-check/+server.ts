import * as v from 'valibot';
import { nameCheckQuerySchema } from '$lib/schemas/name-check';
import { ipLimitKey } from '$lib/server/abuse';
import { payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/http/response';
import { checkName, loadNameSourceCredentials } from '$lib/server/name-check';
import {
	FAN_OUT_BUDGET_MS,
	MAX_BODY_BYTES,
	RATE_LIMIT_MAX,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	RESPONSE_RESERVE_MS,
} from '$lib/server/name-check/config';
import type { RequestHandler } from './$types';

/**
 * One name check as JSON — the same `checkName()` the showcase form calls, for agents
 * and scripts. POST with a body, not GET with `?q=`, so the name stays out of URLs and
 * the logs that record them; the CSRF hook therefore expects `X-Requested-With` (use
 * `apiFetch` from the browser).
 *
 * The limiter runs BEFORE any upstream call: a check fans out to every live source, and
 * the per-IP window is what keeps one visitor from spending the deployment's daily
 * source quotas.
 */
const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async (event) => {
	const { success, reset } = await limiter.limit(ipLimitKey(getClientIp(event)));
	if (!success) return rateLimitResponse(reset);

	const body = await readJsonBounded(event.request, MAX_BODY_BYTES);
	if (!body.ok) {
		return body.reason === 'too_large'
			? payloadTooLargeResponse(MAX_BODY_BYTES)
			: apiError(400, 'invalid_json', 'Body must be a JSON object with a query.');
	}

	const parsed = v.safeParse(nameCheckQuerySchema, body.value);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const report = await checkName(parsed.output, {
		deadline: event.locals.deadline.child(FAN_OUT_BUDGET_MS, { reserveMs: RESPONSE_RESERVE_MS }),
		credentials: await loadNameSourceCredentials(),
	});
	return apiOk(report);
};
