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

/**
 * Cache policy for the public blog-image redirect (`/api/blog/assets/[id]/image`,
 * `/api/blog/media/[...path]`), declared beside the presign it points at because the two
 * numbers are one contract: a cache may hand out a stored redirect for as long as
 * `REDIRECT_LIFETIME_SECONDS`, so the URL inside it must stay valid at least that long.
 *
 * `s-maxage` is what makes Vercel's CDN store the 302 at all — it ignores `max-age`
 * alone — and Vercel strips `s-maxage` / `stale-while-revalidate` before the browser sees
 * the response, so the browser keeps it for `max-age` only. Worst case is still the sum:
 * the CDN serves its last stale second to a browser that then holds it for `max-age`.
 */
const REDIRECT_BROWSER_MAX_AGE = 300;
const REDIRECT_CDN_MAX_AGE = 1800;
const REDIRECT_CDN_STALE = 600;
const REDIRECT_LIFETIME_SECONDS = REDIRECT_BROWSER_MAX_AGE + REDIRECT_CDN_MAX_AGE + REDIRECT_CDN_STALE;

/** Only for assets reachable from a published post — anything else stays `private, no-store`. */
export const PUBLIC_BLOG_IMAGE_CACHE_CONTROL = `public, max-age=${REDIRECT_BROWSER_MAX_AGE}, s-maxage=${REDIRECT_CDN_MAX_AGE}, stale-while-revalidate=${REDIRECT_CDN_STALE}`;

/**
 * Presigned URLs are signed against the start of a fixed window rather than "now", so
 * every request inside one window gets the byte-identical URL — and the browser's cache
 * of the image itself, keyed by that URL, is reused instead of refetched per page view.
 */
const PRESIGN_WINDOW_SECONDS = 900;

/** Headroom for clock skew between this function and R2. */
const PRESIGN_SKEW_SECONDS = 120;

/**
 * Signing date and expiry for a URL that is identical across `PRESIGN_WINDOW_SECONDS` and
 * still valid for at least `minValiditySeconds` from `nowMs`, however late in the window
 * it is issued.
 */
export function windowedSigning(nowMs: number, minValiditySeconds: number): { signingDate: Date; expiresIn: number } {
	const windowMs = PRESIGN_WINDOW_SECONDS * 1000;
	return {
		signingDate: new Date(Math.floor(nowMs / windowMs) * windowMs),
		expiresIn: PRESIGN_WINDOW_SECONDS + minValiditySeconds + PRESIGN_SKEW_SECONDS,
	};
}

/**
 * The presigned URL a public blog-image redirect points at: stable within a window and
 * valid for longer than any cache may serve the redirect (`PUBLIC_BLOG_IMAGE_CACHE_CONTROL`).
 */
export async function generatePublicBlogImageUrl(key: string, nowMs = Date.now()): Promise<PresignedUrlResult> {
	assertBlogKey(key);
	const client = requireS3();
	const { signingDate, expiresIn } = windowedSigning(nowMs, REDIRECT_LIFETIME_SECONDS);
	const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
	const url = await getSignedUrl(client, command, { expiresIn, signingDate });
	const expiresAtMs = signingDate.getTime() + expiresIn * 1000;

	return {
		url,
		expiresIn: Math.floor((expiresAtMs - nowMs) / 1000),
		expiresAt: new Date(expiresAtMs).toISOString(),
	};
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
