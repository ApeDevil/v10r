import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';
import type { PresignedUrlResult } from '../types';
import { assertBlogKey, BLOG_PREFIX } from './guards';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

/**
 * Every object under the blog prefix last modified before `before`.
 *
 * The reaper's input. The cutoff exists so an upload that is legitimately
 * in-flight — presigned, PUT, not yet confirmed — is never a candidate.
 */
export async function listBlogObjectsOlderThan(before: Date): Promise<string[]> {
	const client = requireS3();
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const res = await client.send(
			new ListObjectsV2Command({ Bucket: BUCKET, Prefix: BLOG_PREFIX, ContinuationToken: continuationToken }),
		);
		for (const object of res.Contents ?? []) {
			if (!object.Key || !object.LastModified) continue;
			if (object.LastModified < before) keys.push(object.Key);
		}
		continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
	} while (continuationToken);

	return keys;
}

/** Generate a presigned download URL for a blog asset. */
export async function generateBlogDownloadUrl(key: string, expiresIn = 3600): Promise<PresignedUrlResult> {
	assertBlogKey(key);
	const client = requireS3();
	const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
	const url = await getSignedUrl(client, command, { expiresIn });

	return {
		url,
		expiresIn,
		expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
	};
}
