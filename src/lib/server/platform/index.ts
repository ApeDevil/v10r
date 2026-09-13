import { env } from '$env/dynamic/private';
import type { PlatformInfo } from './types';

export { deferAfterResponse } from './after-response';
export { holdOpenUntil } from './hold-open';

function detect(): PlatformInfo {
	if (env.VERCEL) return { id: 'vercel', persistent: false };
	if (env.FLY_APP_NAME) return { id: 'fly', persistent: true };
	if (env.RAILWAY_ENVIRONMENT) return { id: 'railway', persistent: true };
	return { id: 'container', persistent: true };
}

export const platform: PlatformInfo = detect();
