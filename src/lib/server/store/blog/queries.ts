import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';
import type { PresignedUrlResult } from '../types';
import { assertBlogKey } from './guards';

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

/** Generate a presigned download URL for a blog asset. */
export async function generateBlogDownloadUrl(
	key: string,
	expiresIn = 3600,
): Promise<PresignedUrlResult> {
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
