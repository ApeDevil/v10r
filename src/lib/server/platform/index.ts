import { FLY_APP_NAME, RAILWAY_ENVIRONMENT, VERCEL } from '$app/env/private';
import type { PlatformInfo } from './types';

export { deferAfterResponse } from './after-response';
export { holdOpenUntil } from './hold-open';

function detect(): PlatformInfo {
	if (VERCEL) return { id: 'vercel', persistent: false };
	if (FLY_APP_NAME) return { id: 'fly', persistent: true };
	if (RAILWAY_ENVIRONMENT) return { id: 'railway', persistent: true };
	return { id: 'container', persistent: true };
}

export const platform: PlatformInfo = detect();
