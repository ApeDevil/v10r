import { UPSTASH_REDIS_REST_URL } from '$env/static/private';
import { classifyCacheError } from '$lib/server/cache/errors';
import { verifyConnection } from '$lib/server/cache/showcase/queries';
import { reseedCache } from '$lib/server/cache/showcase/seed';
import type { Actions, PageServerLoad } from './$types';

async function measureConnection() {
	try {
		const info = await verifyConnection();

		return {
			connected: true,
			latencyMs: info.latencyMs,
			keyCount: info.keyCount,
			endpoint: UPSTASH_REDIS_REST_URL ? `${UPSTASH_REDIS_REST_URL.slice(0, 30)}...` : 'unknown',
			measuredAt: info.measuredAt,
		};
	} catch (err) {
		const cacheErr = classifyCacheError(err);

		return {
			connected: false,
			latencyMs: 0,
			error: cacheErr.message,
			errorKind: cacheErr.kind,
			keyCount: null,
			endpoint: null,
			measuredAt: new Date().toISOString(),
		};
	}
}

export const load: PageServerLoad = async () => {
	return measureConnection();
};

export const actions: Actions = {
	retest: async () => {
		return measureConnection();
	},

	reseed: async () => {
		try {
			const { keyCount } = await reseedCache();
			return { success: true, message: `Reseeded ${keyCount} keys.` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return { success: false, message: cacheErr.message };
		}
	},
};
