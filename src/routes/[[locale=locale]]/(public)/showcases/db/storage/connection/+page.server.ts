import { R2_ACCOUNT_ID } from '$env/static/private';
import { classifyS3Error } from '$lib/server/store/errors';
import { verifyConnection } from '$lib/server/store/showcase/queries';
import { reseedBucket } from '$lib/server/store/showcase/seed';
import { formatBytes } from '$lib/server/store/types';
import type { Actions, PageServerLoad } from './$types';

async function measureConnection() {
	const start = performance.now();

	try {
		const info = await verifyConnection();
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			title: 'Connection - Storage - Showcases',
			connected: true,
			latencyMs,
			bucketName: info.bucketName,
			region: info.region,
			objectCount: info.stats.objectCount,
			totalSize: info.stats.totalSize,
			totalSizeFormatted: formatBytes(info.stats.totalSize),
			accountId: R2_ACCOUNT_ID ? `${R2_ACCOUNT_ID.slice(0, 6)}...` : 'unknown',
			measuredAt: new Date().toISOString(),
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;
		const storeErr = classifyS3Error(err);

		return {
			connected: false,
			latencyMs,
			error: storeErr.message,
			errorKind: storeErr.kind,
			bucketName: null,
			region: null,
			objectCount: null,
			totalSize: null,
			totalSizeFormatted: null,
			accountId: null,
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
			const { objectCount } = await reseedBucket();
			return { success: true, message: `Reseeded ${objectCount} objects.` };
		} catch (err) {
			const storeErr = classifyS3Error(err);
			return { success: false, message: storeErr.message };
		}
	},
};
