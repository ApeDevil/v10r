/**
 * Canonical version / build information so a caller can identify exactly which deployed v10r
 * instance answered. Surfaced in the `initialize` result, in the endpoint's GET metadata, and
 * (for the demo state) alongside every read/write.
 */
import { env } from '$env/dynamic/private';
import { REGISTRY } from './patterns/data';

/** Mirrors package.json "version". Kept as a constant to avoid bundling package.json here. */
export const APP_VERSION = '0.0.1';

/** Protocol versions this transport understands, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
export const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[1];

export function isSupportedProtocolVersion(value: unknown): value is string {
	return typeof value === 'string' && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

export function negotiateProtocolVersion(requested: unknown): string {
	return isSupportedProtocolVersion(requested) ? requested : DEFAULT_PROTOCOL_VERSION;
}

/** Full deploy identity — the Vercel commit SHA + env. For AUTHENTICATED surfaces only. */
export function buildInfo() {
	return {
		app: APP_VERSION,
		patternRegistry: REGISTRY.version,
		commit: env.VERCEL_GIT_COMMIT_SHA || 'local',
		environment: env.VERCEL_ENV || 'development',
	};
}

/**
 * Coarse version identity for the UNAUTHENTICATED public endpoint. Enough for a caller to
 * identify the deployed v10r version, without fingerprinting the exact commit SHA / env of an
 * internet-facing surface.
 */
export function publicBuildInfo() {
	return { app: APP_VERSION, patternRegistry: REGISTRY.version };
}
