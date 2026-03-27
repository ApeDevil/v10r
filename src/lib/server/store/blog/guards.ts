import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { MAX_BLOG_ASSETS } from '$lib/server/config';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';

export const BLOG_PREFIX = 'blog/';

/** Ensure a key is within the blog namespace. */
export function assertBlogKey(key: string): void {
	if (!key.startsWith(BLOG_PREFIX)) {
		throw new StoreError('forbidden', `Key must start with "${BLOG_PREFIX}": ${key}`);
	}
}

/** Check if the blog namespace has room for more objects. */
export async function checkBlogObjectLimit(limit = MAX_BLOG_ASSETS): Promise<string | null> {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	const res = await s3.send(
		new ListObjectsV2Command({
			Bucket: BUCKET,
			Prefix: BLOG_PREFIX,
		}),
	);

	const count = res.KeyCount ?? 0;
	if (count >= limit) {
		return `Blog asset limit reached (${limit} objects). Delete unused assets first.`;
	}
	return null;
}
