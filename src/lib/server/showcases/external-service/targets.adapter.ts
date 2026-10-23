/**
 * The only place the External Service Lab reads its environment.
 *
 * `$env/dynamic/private` under `$lib/server/`: SvelteKit refuses to bundle either into
 * client code, so the credentials cannot reach a browser through an import. Read per call
 * rather than at module load, so a missing variable is an `unconfigured` target — never a
 * crash of the module, and therefore never a crash of anything that imports it.
 */
import { env } from '$env/dynamic/private';
import type { ServiceTargetId } from '$lib/showcases/external-service/types';
import { type ResolvedServiceTarget, resolveServiceTarget } from './targets';

export function readServiceTargets(): Record<ServiceTargetId, ResolvedServiceTarget> {
	return {
		local: resolveServiceTarget('local', {
			url: env.EXTERNAL_SERVICE_LOCAL_URL,
			token: env.EXTERNAL_SERVICE_LOCAL_TOKEN,
		}),
		remote: resolveServiceTarget('remote', {
			url: env.EXTERNAL_SERVICE_REMOTE_URL,
			token: env.EXTERNAL_SERVICE_REMOTE_TOKEN,
		}),
	};
}
