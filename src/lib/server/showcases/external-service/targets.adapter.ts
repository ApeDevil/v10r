/**
 * The only place the External Service Lab reads its environment.
 *
 * `$app/env/private` under `#lib/server/`: SvelteKit refuses to bundle either into
 * client code, so the credentials cannot reach a browser through an import. Read per call
 * rather than at module load, so a missing variable is an `unconfigured` target — never a
 * crash of the module, and therefore never a crash of anything that imports it.
 */

import type { ServiceTargetId } from '#lib/showcases/external-service/types.ts';
import {
	EXTERNAL_SERVICE_LOCAL_TOKEN,
	EXTERNAL_SERVICE_LOCAL_URL,
	EXTERNAL_SERVICE_REMOTE_TOKEN,
	EXTERNAL_SERVICE_REMOTE_URL,
} from '$app/env/private';
import { type ResolvedServiceTarget, resolveServiceTarget } from './targets';

export function readServiceTargets(): Record<ServiceTargetId, ResolvedServiceTarget> {
	return {
		local: resolveServiceTarget('local', {
			url: EXTERNAL_SERVICE_LOCAL_URL,
			token: EXTERNAL_SERVICE_LOCAL_TOKEN,
		}),
		remote: resolveServiceTarget('remote', {
			url: EXTERNAL_SERVICE_REMOTE_URL,
			token: EXTERNAL_SERVICE_REMOTE_TOKEN,
		}),
	};
}
