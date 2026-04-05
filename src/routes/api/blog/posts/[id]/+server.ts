import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { safeParse } from 'valibot';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getLatestRevision, getPostById, getTagsForPost, updatePostMetadata } from '$lib/server/blog';
import { db } from '$lib/server/db';
import { domain } from '$lib/server/db/schema/blog';
import type { RequestHandler } from './$types';

const PatchPostSchema = v.object({
	slug: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200), v.regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/))),
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

	return json({
		post,
		latestRevision,
		tags,
		domain: postDomain,
	});
};

/** Update post metadata (e.g., rename slug). */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid request body.' }, { status: 400 });

	const parsed = safeParse(PatchPostSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request. Slug must be lowercase alphanumeric with hyphens.' }, { status: 400 });
	}

	try {
		const updated = await updatePostMetadata(params.id, parsed.output);
		if (!updated) return json({ error: 'Not found.' }, { status: 404 });
		return json({ post: updated });
	} catch (e: any) {
		if (e?.code === '23505') {
			return json({ error: 'A post with this slug already exists.' }, { status: 409 });
		}
		throw e;
	}
};
