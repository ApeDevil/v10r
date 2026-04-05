import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';
import type { BucketStats, ObjectDetail, ObjectInfo, PresignedUrlResult, RangeResult } from '../types';
import { SHOWCASE_PREFIX } from './guards';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

// ─── Connection page ────────────────────────────────────

export interface ConnectionResult {
	reachable: boolean;
	bucketName: string;
	region: string;
	stats: BucketStats;
}

export async function verifyConnection(): Promise<ConnectionResult> {
	const client = requireS3();
	await client.send(new HeadBucketCommand({ Bucket: BUCKET }));

	const stats = await getBucketStats();

	return {
		reachable: true,
		bucketName: BUCKET,
		region: 'auto',
		stats,
	};
}

async function getBucketStats(): Promise<BucketStats> {
	const client = requireS3();
	let objectCount = 0;
	let totalSize = 0;
	let continuationToken: string | undefined;

	do {
		const res = await client.send(
			new ListObjectsV2Command({
				Bucket: BUCKET,
				Prefix: SHOWCASE_PREFIX,
				ContinuationToken: continuationToken,
			}),
		);

		for (const obj of res.Contents ?? []) {
			objectCount++;
			totalSize += obj.Size ?? 0;
		}

		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return { objectCount, totalSize };
}

// ─── Objects page ───────────────────────────────────────

export async function listShowcaseObjects(): Promise<ObjectInfo[]> {
	const client = requireS3();
	const objects: ObjectInfo[] = [];
	let continuationToken: string | undefined;

	do {
		const res = await client.send(
			new ListObjectsV2Command({
				Bucket: BUCKET,
				Prefix: SHOWCASE_PREFIX,
				ContinuationToken: continuationToken,
			}),
		);

		for (const obj of res.Contents ?? []) {
			objects.push({
				key: obj.Key!,
				size: obj.Size ?? 0,
				lastModified: obj.LastModified ?? new Date(),
				etag: obj.ETag ?? '',
			});
		}

		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return objects.sort((a, b) => a.key.localeCompare(b.key));
}

export async function getObjectDetail(key: string): Promise<ObjectDetail> {
	const client = requireS3();
	const res = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));

	return {
		key,
		size: res.ContentLength ?? 0,
		lastModified: res.LastModified ?? new Date(),
		etag: res.ETag ?? '',
		contentType: res.ContentType,
		metadata: res.Metadata ?? {},
		cacheControl: res.CacheControl,
		contentEncoding: res.ContentEncoding,
	};
}

export async function generateDownloadUrl(key: string, expiresIn: number): Promise<PresignedUrlResult> {
	const client = requireS3();
	const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
	const url = await getSignedUrl(client, command, { expiresIn });

	return {
		url,
		expiresIn,
		expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
	};
}

// ─── Transfer page ──────────────────────────────────────

export async function getObjectRange(key: string, start: number, end: number): Promise<RangeResult> {
	const client = requireS3();
	const res = await client.send(
		new GetObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Range: `bytes=${start}-${end}`,
		}),
	);

	const body = await res.Body?.transformToByteArray();
	if (!body) throw new StoreError('not_found', `Empty response body for key: ${key}`);

	return {
		data: body,
		contentRange: res.ContentRange ?? `bytes ${start}-${end}/*`,
		contentLength: res.ContentLength ?? body.length,
	};
}
