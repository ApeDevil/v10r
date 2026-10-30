/**
 * Asset production policy: what one run may spend in each place it runs. Every number that
 * bounds CPU, memory, bytes or rate lives here, not at a call site. A request never raises
 * these — it can only ask for less.
 */
import { type AssetBudget, DEFAULT_ASSET_BUDGET } from '#lib/asset-production/index.ts';

/** Anonymous showcase runs, in the serverless function that answers the request. */
export const SHOWCASE_BUDGET: AssetBudget = DEFAULT_ASSET_BUDGET;
/** Carved from the request's 10 s hook budget; the largest in-bounds ring takes about 0.2 s warm. */
export const SHOWCASE_RUN_MS = 4_000;
/** Held back to serialise and send the response. */
export const SHOWCASE_RESPONSE_RESERVE_MS = 500;
export const RATE_LIMIT_PREFIX = 'rl:asset-production';
/** Runs per IP per window: each one is real CPU in the deployment's function. */
export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW = '60 s' as const;
/** A request is a few hundred bytes; anything near this is not one. */
export const MAX_ASSET_REQUEST_BYTES = 4 * 1024;

/** The isolated worker process: a hard wall-clock kill, and a cap on what it may print. */
export const ISOLATED_RUN_MS = 30_000;
/** base64 of the largest permitted GLB, plus the report. Past this the worker is killed. */
export const ISOLATED_MAX_OUTPUT_BYTES = Math.ceil(DEFAULT_ASSET_BUDGET.maxGlbBytes * 1.4) + 1024 * 1024;
