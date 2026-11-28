/**
 * Canonical version / build information so a caller can identify exactly which deployed v10r
 * instance answered. Surfaced in the `initialize` result, in the endpoint's GET metadata, and
 * (for the demo state) alongside every read/write.
 */

import { REGISTRY } from '#lib/server/patterns/index.ts';
import { registryDigest } from '#patterns/registry-digest.ts';
import { VERCEL_ENV, VERCEL_GIT_COMMIT_SHA } from '$app/env/private';

/** Mirrors package.json "version". Kept as a constant to avoid bundling package.json here. */
export const APP_VERSION = '0.0.1';

/** The registry's content identity — which pattern knowledge answered, independent of the deploy. */
const PATTERN_REGISTRY_DIGEST = registryDigest(REGISTRY);

/** Full deploy identity — the Vercel commit SHA + env. For AUTHENTICATED surfaces only. */
export function buildInfo() {
	return {
		app: APP_VERSION,
		patternRegistry: PATTERN_REGISTRY_DIGEST,
		commit: VERCEL_GIT_COMMIT_SHA || 'local',
		environment: VERCEL_ENV || 'development',
	};
}

/**
 * Coarse version identity for the UNAUTHENTICATED public endpoint. Enough for a caller to
 * identify the deployed v10r version, without fingerprinting the exact commit SHA / env of an
 * internet-facing surface.
 */
export function publicBuildInfo() {
	return { app: APP_VERSION, patternRegistry: PATTERN_REGISTRY_DIGEST };
}
