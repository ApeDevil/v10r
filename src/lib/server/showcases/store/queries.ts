import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { BucketStats, ObjectDetail, ObjectInfo, PresignedUrlResult, RangeResult } from '$lib/server/store';
import { assertShowcaseKey, isPublicShowcaseKey, SHOWCASE_PREFIX, StoreError } from '$lib/server/store';
import { PRESIGNED_URL_EXPIRY } from '$lib/server/store/config';
import { BUCKET, s3 } from '$lib/server/store/index';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

/** Shortest TTL worth signing; the ceiling is PRESIGNED_URL_EXPIRY. */
const MIN_PRESIGN_TTL = 60;

/**
 * Bound a caller-supplied TTL. The demo page lets a visitor pick an expiry, and
 * SigV4 would otherwise happily sign a 7-day URL for anything it is handed.
 */
function clampPresignTtl(expiresIn: number): number {
	const requested = Math.floor(expiresIn);
	if (!Number.isFinite(requested) || requested <= 0) return PRESIGNED_URL_EXPIRY;
	return Math.min(Math.max(requested, MIN_PRESIGN_TTL), PRESIGNED_URL_EXPIRY);
}

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
			// Private per-user namespaces share this prefix for lifecycle-rule
			// reasons only; they are not showcase material and must not be
			// counted, listed, or made addressable through the public demo.
			if (!isPublicShowcaseKey(obj.Key ?? '')) continue;
			objectCount++;
			totalSize += obj.Size ?? 0;
		}

		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return { objectCount, totalSize };
}

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
			// See getBucketStats: the listing is what turns a read primitive into
			// an enumeration oracle, because these keys embed a user id.
			if (!isPublicShowcaseKey(obj.Key ?? '')) continue;
			objects.push({
				key: obj.Key ?? '',
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
	assertShowcaseKey(key);
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
	assertShowcaseKey(key);
	const client = requireS3();
	const ttl = clampPresignTtl(expiresIn);
	const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
	const url = await getSignedUrl(client, command, { expiresIn: ttl });

	// Report the TTL actually signed, not the one asked for.
	return {
		url,
		expiresIn: ttl,
		expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
	};
}

/** Max bytes one range read may return — a hex-dump window, not a download. */
const MAX_RANGE_BYTES = 1024;

export async function getObjectRange(key: string, start: number, end: number): Promise<RangeResult> {
	assertShowcaseKey(key);
	const client = requireS3();

	// Bounded here rather than only in the route: an unbounded (or negative)
	// window turns a 1 KiB inspector into an arbitrary-length reader, and the
	// route is one caller among N.
	const from = Math.max(0, Math.floor(start) || 0);
	const to = Math.min(Math.floor(end) || 0, from + MAX_RANGE_BYTES - 1);
	if (to < from) throw new StoreError('forbidden', 'Range end must not precede range start.');

	const res = await client.send(
		new GetObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Range: `bytes=${from}-${to}`,
		}),
	);

	const body = await res.Body?.transformToByteArray();
	if (!body) throw new StoreError('not_found', `Empty response body for key: ${key}`);

	return {
		data: body,
		contentRange: res.ContentRange ?? `bytes ${from}-${to}/*`,
		contentLength: res.ContentLength ?? body.length,
	};
}
