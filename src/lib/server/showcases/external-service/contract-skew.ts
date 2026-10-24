/**
 * How a running service's contract relates to the one this app was built against — a
 * diagnosis, never a gate. Calls are not refused on skew: every response is still
 * validated against the contract mirrors, and that validation is what decides whether an
 * answer is usable. Skew explains a `malformed_response` before anyone reads a diff.
 *
 * The service reports its `release` (`/v1/status`), the app knows `CONTRACT_RELEASE`, and
 * both follow the rule `contract-releases.json` enforces: releases sharing major.minor share
 * one contract (a patch never changes it); a minor bump is additive from 1.0 on; a major bump
 * — and in 0.x a minor one — may break. Additive is directional: responses are read open, so
 * a service AHEAD of the app adds what the app ignores, while one BEHIND it lacks what the
 * app expects — the reason to deploy the service first (expand, then contract).
 */
import type { ContractSkew } from '$lib/showcases/external-service/types';

/** A release: plain major.minor.patch, no pre-release tag. The generator refuses any other. */
export const RELEASE_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function contractSkew(serviceRelease: string, appRelease: string): ContractSkew {
	const service = RELEASE_PATTERN.exec(serviceRelease);
	const app = RELEASE_PATTERN.exec(appRelease);
	if (!service || !app) return 'unknown';
	const [serviceMajor, serviceMinor] = [Number(service[1]), Number(service[2])];
	const [appMajor, appMinor] = [Number(app[1]), Number(app[2])];

	if (serviceMajor !== appMajor) return 'breaking';
	if (serviceMinor === appMinor) return 'none';
	if (appMajor === 0) return 'breaking';
	return serviceMinor > appMinor ? 'service_ahead' : 'service_behind';
}
