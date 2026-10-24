import { classifyCacheError } from '#lib/server/cache/errors.ts';
import { verifyConnection } from '#lib/server/showcases/cache/queries.ts';
import { reseedCache } from '#lib/server/showcases/cache/seed.ts';
import { UPSTASH_REDIS_REST_URL } from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';

async function measureConnection() {
	try {
		const info = await verifyConnection();

		return {
			title: 'Connection - Cache - Showcases',
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
