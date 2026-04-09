import { env } from '$env/dynamic/private';
import {
	computePercentage,
	computeThreshold,
	FREE_TIER_LIMITS,
	type ProviderResult,
	sanitizeError,
	type UpstashMetrics,
} from './index';

export async function fetchUpstashMetrics(): Promise<ProviderResult<UpstashMetrics>> {
	const { UPSTASH_MGMT_API_KEY, UPSTASH_EMAIL, UPSTASH_DB_ID } = env;

	if (!UPSTASH_MGMT_API_KEY || !UPSTASH_EMAIL || !UPSTASH_DB_ID) {
		return {
			status: 'unavailable',
			data: null,
			error: 'Management API not configured',
			measuredAt: new Date().toISOString(),
			latencyMs: 0,
		};
	}

	const start = performance.now();

	try {
		const auth = `Basic ${btoa(`${UPSTASH_EMAIL}:${UPSTASH_MGMT_API_KEY}`)}`;
		const headers = { Authorization: auth };

		const [dbResponse, statsResponse] = await Promise.all([
			fetch(`https://api.upstash.com/v2/redis/database/${UPSTASH_DB_ID}`, { headers }),
			fetch(`https://api.upstash.com/v2/redis/stats/${UPSTASH_DB_ID}`, { headers }),
		]);

		if (!dbResponse.ok) throw new Error(`Database API: HTTP ${dbResponse.status}`);
		if (!statsResponse.ok) throw new Error(`Stats API: HTTP ${statsResponse.status}`);

		const dbData = (await dbResponse.json()) as Record<string, unknown>;
		const statsData = (await statsResponse.json()) as Record<string, unknown>;

		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		const storageBytes = Number(statsData.current_storage ?? 0);
		const storageLimit = Number(dbData.db_disk_threshold ?? FREE_TIER_LIMITS.upstash.storageBytes);
		const commandsUsed = Number(statsData.total_monthly_requests ?? 0);
		const commandsLimit = FREE_TIER_LIMITS.upstash.commands;

		return {
			status: 'ok',
			data: {
				commandsUsed,
				commandsLimit,
				commandsPercentage: computePercentage(commandsUsed, commandsLimit),
				commandsThreshold: computeThreshold(commandsUsed, commandsLimit),
				storageBytes,
				storageLimit,
				storagePercentage: computePercentage(storageBytes, storageLimit),
				storageThreshold: computeThreshold(storageBytes, storageLimit),
			},
			error: null,
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			status: 'unavailable',
			data: null,
			error: sanitizeError(err),
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	}
}
