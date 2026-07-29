import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { MAX_SHOWCASE_OBJECTS } from '$lib/server/config';
import { StoreError } from '../errors';
import { BUCKET, s3 } from '../index';

export const SHOWCASE_PREFIX = 'showcase/';

/**
 * Per-user namespaces that sit under `showcase/` ONLY so one R2 lifecycle rule
 * can target them. They hold real user uploads and are NOT part of the public
 * showcase surface — the key itself embeds a user id, so exposing them through
 * the anonymous storage demo would both leak the objects and enumerate users.
 *
 * Anything added under `showcase/` that is not seed data or an anonymous demo
 * upload belongs on this list.
 */
export const SHOWCASE_PRIVATE_PREFIXES = ['showcase/imagemeta/', 'showcase/imagekit/'] as const;

/** True when a key is public showcase material rather than private user data. */
export function isPublicShowcaseKey(key: string): boolean {
	return key.startsWith(SHOWCASE_PREFIX) && !SHOWCASE_PRIVATE_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Ensure a key is within the PUBLIC showcase namespace.
 *
 * Call this before `requireS3()`, never after: `requireS3()` throws when R2 is
 * unconfigured, so guarding second makes the authorization check unreachable in
 * any environment without credentials — a config value would decide whether a
 * security control runs. See `store/blog/queries.ts:15-16` for the right order.
 */
export function assertShowcaseKey(key: string): void {
	if (!key.startsWith(SHOWCASE_PREFIX)) {
		throw new StoreError('forbidden', `Key must start with "${SHOWCASE_PREFIX}": ${key}`);
	}
	if (SHOWCASE_PRIVATE_PREFIXES.some((p) => key.startsWith(p))) {
		throw new StoreError('forbidden', 'Key is in a private namespace and is not reachable from the showcase.');
	}
}

/** Check if the showcase namespace has room for more objects. */
export async function checkObjectLimit(limit = MAX_SHOWCASE_OBJECTS): Promise<string | null> {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	const res = await s3.send(
		new ListObjectsV2Command({
			Bucket: BUCKET,
			Prefix: SHOWCASE_PREFIX,
		}),
	);

	const count = res.KeyCount ?? 0;
	if (count >= limit) {
		return `Showcase limit reached (${limit} objects). Use reseed to clear.`;
	}
	return null;
}
