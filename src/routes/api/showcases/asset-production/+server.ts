import { ipLimitKey } from '#lib/server/abuse/index.ts';
import {
	MAX_ASSET_REQUEST_BYTES,
	RATE_LIMIT_MAX,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	SHOWCASE_BUDGET,
	SHOWCASE_RESPONSE_RESERVE_MS,
	SHOWCASE_RUN_MS,
} from '#lib/server/asset-production/config.ts';
import { inProcessEnvironment, runAssetJob } from '#lib/server/asset-production/index.ts';
import { payloadTooLargeResponse, readJsonBounded } from '#lib/server/http/body.ts';
import { getClientIp } from '#lib/server/http/client-ip.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiOk } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

/**
 * One asset production job for the 3D showcase: an `AssetRequest` in, the report and the GLB
 * (base64) out. POST with `X-Requested-With` (use `apiFetch`) — the CSRF hook expects it.
 *
 * The limiter runs before any geometry: a run is real CPU in this function. The run's own
 * deadline is carved from the request's, so a slow run stops with `run.deadline` instead of
 * the platform killing the function. Nothing is stored — the asset goes back to the visitor
 * who asked for it and nowhere else; no IP or identity enters the report.
 *
 * Status: 200 succeeded · 422 refused (the findings say why) · 503 cancelled · 500 failed.
 */
const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
const STATUS = { succeeded: 200, refused: 422, cancelled: 503, failed: 500 } as const;

export const POST: RequestHandler = async (event) => {
	const { success, reset } = await limiter.limit(ipLimitKey(getClientIp(event)));
	if (!success) return rateLimitResponse(reset);

	const body = await readJsonBounded(event.request, MAX_ASSET_REQUEST_BYTES);
	if (!body.ok) {
		return body.reason === 'too_large'
			? payloadTooLargeResponse(MAX_ASSET_REQUEST_BYTES)
			: apiError(400, 'invalid_json', 'Body must be a JSON asset request.');
	}

	const runMs = Math.min(SHOWCASE_RUN_MS, event.locals.deadline.remainingMs() - SHOWCASE_RESPONSE_RESERVE_MS);
	const { report, glb } = await runAssetJob(body.value, {
		environment: inProcessEnvironment,
		budget: SHOWCASE_BUDGET,
		runMs: Math.max(0, runMs),
		owner: 'showcase',
		agent: { kind: 'human', label: 'showcase visitor' },
		jobId: crypto.randomUUID(),
		signal: event.request.signal,
	});
	return apiOk({ report, glbBase64: glb ? Buffer.from(glb).toString('base64') : undefined }, STATUS[report.outcome]);
};
