import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';
import { BUCKET, s3 } from '$lib/server/store';
import {
	type ProviderResult,
	type R2Metrics,
	FREE_TIER_LIMITS,
	computePercentage,
	computeThreshold,
	sanitizeError,
} from './index';

async function fetchViaGraphQL(
	accountId: string,
	token: string,
	bucket: string,
): Promise<{ storageBytes: number; objectCount: number }> {
	const query = `query ($accountTag: string!, $bucket: string!) {
		viewer {
			accounts(filter: { accountTag: $accountTag }) {
				r2StorageAdaptiveGroups(
					limit: 1
					filter: { bucketName: $bucket }
					orderBy: [datetime_DESC]
				) {
					max { payloadSize objectCount }
				}
			}
		}
	}`;

	const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			query,
			variables: { accountTag: accountId, bucket },
		}),
	});

	if (!response.ok) throw new Error(`Cloudflare GraphQL: HTTP ${response.status}`);

	const result = (await response.json()) as {
		data?: {
			viewer?: {
				accounts?: Array<{
					r2StorageAdaptiveGroups?: Array<{
						max?: { payloadSize: number; objectCount: number };
					}>;
				}>;
			};
		};
	};

	const groups = result.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups;
	const max = groups?.[0]?.max;

	return {
		storageBytes: Number(max?.payloadSize ?? 0),
		objectCount: Number(max?.objectCount ?? 0),
	};
}

async function fetchViaListObjects(): Promise<{ storageBytes: number; objectCount: number }> {
	if (!s3) throw new Error('R2 storage is not configured');

	let objectCount = 0;
	let storageBytes = 0;
	let continuationToken: string | undefined;

	do {
		const res = await s3.send(
			new ListObjectsV2Command({
				Bucket: BUCKET,
				ContinuationToken: continuationToken,
			}),
		);

		for (const obj of res.Contents ?? []) {
			objectCount++;
			storageBytes += obj.Size ?? 0;
		}

		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return { storageBytes, objectCount };
}

export async function fetchR2Metrics(): Promise<ProviderResult<R2Metrics>> {
	const start = performance.now();

	try {
		const analyticsToken = env.CLOUDFLARE_ANALYTICS_TOKEN;
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const bucket = env.R2_BUCKET_NAME;

		let result: { storageBytes: number; objectCount: number };

		if (analyticsToken && accountId && bucket) {
			result = await fetchViaGraphQL(accountId, analyticsToken, bucket);
		} else {
			result = await fetchViaListObjects();
		}

		const latencyMs = Math.round((performance.now() - start) * 100) / 100;
		const storageLimit = FREE_TIER_LIMITS.r2.storageBytes;

		return {
			status: 'ok',
			data: {
				storageBytes: result.storageBytes,
				storageLimit,
				storagePercentage: computePercentage(result.storageBytes, storageLimit),
				storageThreshold: computeThreshold(result.storageBytes, storageLimit),
				objectCount: result.objectCount,
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
