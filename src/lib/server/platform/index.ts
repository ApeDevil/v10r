import { env } from '$env/dynamic/private';
import type { PlatformInfo } from './types';

function detect(): PlatformInfo {
	if (env.VERCEL) return { id: 'vercel', persistent: false };
	return { id: 'container', persistent: true };
}

export const platform: PlatformInfo = detect();
