import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getLatestRevision, getPostById, getTagsForPost, updatePostMetadata } from '$lib/server/blog';
import { getPostFolder } from '$lib/server/blog/post-folders';
import { db } from '$lib/server/db';
import { domain } from '$lib/server/db/schema/blog';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:posts:update', 30, '1 m');

const PatchPostSchema = v.object({
	slug: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200), v.regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/))),
	/** Null moves the post to the blog root (virtual:blog on the client). */
	folderId: v.optional(v.nullable(v.pipe(v.string(), v.startsWith('pfd_')))),
});

/** Get post + latest revision for editing. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const [latestRevision, tags] = await Promise.all([getLatestRevision(params.id), getTagsForPost(params.id)]);

	let postDomain = null;
	if (post.domainId) {
		const [d] = await db
			.select({ id: domain.id, slug: domain.slug, name: domain.name, icon: domain.icon, color: domain.color })
			.from(domain)
			.where(eq(domain.id, post.domainId))
			.limit(1);
		postDomain = d ?? null;
	}

	return apiOk({ post, latestRevision, tags, domain: postDomain });
};

/** Update post metadata (e.g., rename slug). */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(PatchPostSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	// Verify caller owns the destination folder — narrow FK already prevents
	// cross-kind placement, but we want a clean 404 instead of a raw PG 23503.
	if (parsed.output.folderId) {
		const folder = await getPostFolder(parsed.output.folderId, user.id);
		if (!folder) return apiError(404, 'folder_not_found', 'Target folder not found.');
	}

	try {
		const updated = await updatePostMetadata(params.id, parsed.output);
		if (!updated) return apiError(404, 'not_found', 'Post not found.');
		return apiOk({ post: updated });
	} catch (e: unknown) {
		if (e instanceof Error && 'code' in e && (e as { code: string }).code === '23505') {
			return apiError(409, 'slug_taken', 'A post with this slug already exists.');
		}
		throw e;
	}
};
