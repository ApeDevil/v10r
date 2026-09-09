import { ipLimitKey } from '$lib/server/abuse';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import { VELOCITY_MEASURE_RATE_LIMIT_MAX, VELOCITY_MEASURE_RATE_LIMIT_WINDOW } from '$lib/server/showcases/config';
import { runVelocityMeasurement } from '$lib/server/showcases/velocity';
import { isVelocityMeasurementId } from '$lib/showcases/velocity/measurement';
import type { RequestHandler } from './$types';

/**
 * Runs one Velocity measurement and returns what it measured.
 *
 * On demand rather than in the page's `load` for the obvious reason: each run spends
 * a few hundred milliseconds of deliberate sleeping, and a showcase about latency
 * that makes you wait a second for its own first byte would be arguing against
 * itself. The page loads instantly; the measurements run when asked.
 *
 * The limiter comes BEFORE the work, so the sleeps cannot be used to amplify
 * function-time cost. Nothing here reads or writes user data, and nothing touches
 * Postgres — see `measurements.ts` for why the dependency is simulated.
 */
const limiter = createLimiter(
	'rl:showcase:velocity',
	VELOCITY_MEASURE_RATE_LIMIT_MAX,
	VELOCITY_MEASURE_RATE_LIMIT_WINDOW,
);

export const POST: RequestHandler = async (event) => {
	const { success, reset } = await limiter.limit(ipLimitKey(getClientIp(event)));
	if (!success) return rateLimitResponse(reset);

	const id = event.url.searchParams.get('id');
	if (!isVelocityMeasurementId(id)) {
		return apiError(400, 'unknown_measurement', `Unknown measurement '${id}'.`);
	}

	// The request's own tracer: the arms the page renders are the spans this response's
	// Server-Timing header carries, not a second, private measurement of the same thing.
	return apiOk(await runVelocityMeasurement(id, event.locals.timing));
};
