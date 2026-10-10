import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

/**
 * The public blog-image redirect is cached by the browser and by Vercel's CDN, so the
 * presigned URL inside it must outlive every cache that may serve it — and should be the
 * same URL for every request in a window, so the image itself stays browser-cached.
 * Presigning is offline, so a real client with throwaway credentials signs here.
 */
vi.mock('../index', () => ({
	BUCKET: 'test-bucket',
	s3: new S3Client({
		region: 'auto',
		endpoint: 'https://account.r2.cloudflarestorage.com',
		credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret' },
	}),
}));

const { generatePublicBlogImageUrl, PUBLIC_BLOG_IMAGE_CACHE_CONTROL, windowedSigning } = await import('./queries');

const KEY = 'blog/0b1c2d3e.png';
const WINDOW_START = Date.UTC(2026, 9, 10, 12, 0, 0);

/** The longest a cache may serve one redirect, read back from the header itself. */
function redirectLifetimeSeconds(): number {
	const directive = (name: string) => Number(PUBLIC_BLOG_IMAGE_CACHE_CONTROL.match(new RegExp(`${name}=(\\d+)`))?.[1]);
	return directive('max-age') + directive('s-maxage') + directive('stale-while-revalidate');
}

describe('PUBLIC_BLOG_IMAGE_CACHE_CONTROL', () => {
	it('is shared-cacheable on Vercel, which needs s-maxage', () => {
		expect(PUBLIC_BLOG_IMAGE_CACHE_CONTROL).toMatch(/^public, /);
		expect(PUBLIC_BLOG_IMAGE_CACHE_CONTROL).toMatch(/s-maxage=\d+/);
		expect(PUBLIC_BLOG_IMAGE_CACHE_CONTROL).not.toMatch(/private|no-store|no-cache/);
	});
});

describe('windowedSigning', () => {
	it('stays valid for the requested time even when issued at the last second of a window', () => {
		const lateInWindow = WINDOW_START + 899_999;
		const { signingDate, expiresIn } = windowedSigning(lateInWindow, 2700);
		const remaining = (signingDate.getTime() + expiresIn * 1000 - lateInWindow) / 1000;
		expect(remaining).toBeGreaterThanOrEqual(2700);
	});

	it('signs every request in a window against the same date', () => {
		expect(windowedSigning(WINDOW_START + 1, 60).signingDate).toEqual(
			windowedSigning(WINDOW_START + 800_000, 60).signingDate,
		);
	});
});

describe('generatePublicBlogImageUrl', () => {
	it('returns the byte-identical URL across one window, and a new one in the next', async () => {
		const early = await generatePublicBlogImageUrl(KEY, WINDOW_START + 5_000);
		const late = await generatePublicBlogImageUrl(KEY, WINDOW_START + 890_000);
		const next = await generatePublicBlogImageUrl(KEY, WINDOW_START + 905_000);
		expect(late.url).toBe(early.url);
		expect(next.url).not.toBe(early.url);
	});

	it('outlives every cache that may serve the redirect', async () => {
		const issuedAt = WINDOW_START + 899_000;
		const result = await generatePublicBlogImageUrl(KEY, issuedAt);
		expect(result.expiresIn).toBeGreaterThanOrEqual(redirectLifetimeSeconds());

		// The signed URL itself carries the same promise, not just the returned metadata.
		const url = new URL(result.url);
		const amzDate = url.searchParams.get('X-Amz-Date') ?? '';
		const signedAt = Date.UTC(
			Number(amzDate.slice(0, 4)),
			Number(amzDate.slice(4, 6)) - 1,
			Number(amzDate.slice(6, 8)),
			Number(amzDate.slice(9, 11)),
			Number(amzDate.slice(11, 13)),
			Number(amzDate.slice(13, 15)),
		);
		const validUntil = signedAt + Number(url.searchParams.get('X-Amz-Expires')) * 1000;
		expect((validUntil - issuedAt) / 1000).toBeGreaterThanOrEqual(redirectLifetimeSeconds());
		// SigV4's hard ceiling is seven days.
		expect(Number(url.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(604800);
	});

	it('refuses a key outside the blog prefix', async () => {
		await expect(generatePublicBlogImageUrl('showcase/x.png')).rejects.toThrow();
	});
});
