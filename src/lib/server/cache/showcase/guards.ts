import { CacheError } from '../errors';

export const SHOWCASE_PREFIX = 'showcase:';

/** Ensure a key is within the showcase namespace. */
export function assertShowcaseKey(key: string): void {
	if (!key.startsWith(SHOWCASE_PREFIX)) {
		throw new CacheError('command', `Key must start with "${SHOWCASE_PREFIX}": ${key}`);
	}
}
