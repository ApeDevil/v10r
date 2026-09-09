import { describe, expect, it, vi } from 'vitest';

/**
 * The namespace guard for anonymous R2 reads.
 *
 * `showcase/` is the only prefix the unauthenticated storage demo may reach, and two
 * subtrees under it are NOT demo material: they hold real user uploads whose keys embed
 * a user id, so exposing them would leak the objects AND enumerate users. This is the
 * control for that class — an unauthenticated arbitrary-object read — so it is tested on
 * the predicates themselves rather than only through the endpoint that calls them.
 *
 * `./index` is stubbed because importing it constructs an S3 client from env; the two
 * functions under test touch neither.
 */
vi.mock('./index', () => ({ s3: null, BUCKET: 'test-bucket' }));

const { assertShowcaseKey, isPublicShowcaseKey, SHOWCASE_PREFIX, SHOWCASE_PRIVATE_PREFIXES } = await import('./guards');
const { StoreError } = await import('./errors');

describe('isPublicShowcaseKey', () => {
	it('accepts a key inside the public showcase namespace', () => {
		expect(isPublicShowcaseKey('showcase/hero.png')).toBe(true);
		expect(isPublicShowcaseKey('showcase/nested/deep/file.webp')).toBe(true);
	});

	it('rejects every declared private prefix', () => {
		for (const prefix of SHOWCASE_PRIVATE_PREFIXES) {
			expect(isPublicShowcaseKey(`${prefix}usr_123/photo.jpg`), prefix).toBe(false);
		}
	});

	it('rejects a key outside the showcase namespace entirely', () => {
		for (const key of ['blog/post.png', 'avatars/usr_1.png', '', 'showcas/e.png']) {
			expect(isPublicShowcaseKey(key), key).toBe(false);
		}
	});

	/**
	 * The guard is a prefix test, so a sibling namespace whose name merely STARTS with
	 * `showcase` must not inherit public status — `showcase-private/` is not `showcase/`.
	 */
	it('does not admit a sibling namespace that merely starts with the prefix', () => {
		expect(isPublicShowcaseKey('showcase-private/secret.png')).toBe(false);
		expect(isPublicShowcaseKey('showcaseimagemeta/x.png')).toBe(false);
	});
});

describe('assertShowcaseKey', () => {
	it('passes a public showcase key', () => {
		expect(() => assertShowcaseKey('showcase/hero.png')).not.toThrow();
	});

	it('throws a forbidden StoreError for a key outside the namespace', () => {
		expect(() => assertShowcaseKey('blog/post.png')).toThrow(StoreError);
		try {
			assertShowcaseKey('blog/post.png');
		} catch (e) {
			expect((e as InstanceType<typeof StoreError>).kind).toBe('forbidden');
		}
	});

	it('throws for every private prefix — these hold real user uploads, not demo material', () => {
		for (const prefix of SHOWCASE_PRIVATE_PREFIXES) {
			expect(() => assertShowcaseKey(`${prefix}usr_123/photo.jpg`), prefix).toThrow(StoreError);
		}
	});

	/**
	 * A traversal segment must not walk out of the namespace. The key still starts with
	 * `showcase/`, so the prefix check alone passes it — this pins that behaviour so a
	 * reader knows the guard is a namespace check, not a path resolver, and that callers
	 * must not join these keys onto a filesystem path.
	 */
	it('is a namespace check, not a path resolver — documents the traversal limit', () => {
		expect(() => assertShowcaseKey('showcase/../blog/post.png')).not.toThrow();
	});

	it('agrees with isPublicShowcaseKey on every case', () => {
		const keys = [
			'showcase/a.png',
			'blog/b.png',
			`${SHOWCASE_PREFIX}nested/c.png`,
			...SHOWCASE_PRIVATE_PREFIXES.map((p) => `${p}usr_1/d.png`),
		];
		for (const key of keys) {
			const threw = (() => {
				try {
					assertShowcaseKey(key);
					return false;
				} catch {
					return true;
				}
			})();
			expect(threw, key).toBe(!isPublicShowcaseKey(key));
		}
	});
});
