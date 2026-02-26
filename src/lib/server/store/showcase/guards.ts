import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3, BUCKET } from '../index';
import { StoreError } from '../errors';
import { MAX_SHOWCASE_OBJECTS } from '$lib/server/config';

const SHOWCASE_PREFIX = 'showcase/';

/** Ensure a key is within the showcase namespace. */
export function assertShowcaseKey(key: string): void {
	if (!key.startsWith(SHOWCASE_PREFIX)) {
		throw new StoreError('forbidden', `Key must start with "${SHOWCASE_PREFIX}": ${key}`);
	}
}

/** Check if the showcase namespace has room for more objects. */
export async function checkObjectLimit(
	limit = MAX_SHOWCASE_OBJECTS,
): Promise<string | null> {
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
