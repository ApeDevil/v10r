import { json, error } from '@sveltejs/kit';
import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { getPostById, getLatestRevision, getTagsForPost, getDomainBySlug } from '$lib/server/blog';
import { db } from '$lib/server/db';
import { domain } from '$lib/server/db/schema/blog';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/** Get post + latest revision for editing. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiAuthor(locals);

	const post = await getPostById(params.id);
	requirePostOwnership(post, user);

	const [latestRevision, tags] = await Promise.all([
		getLatestRevision(params.id),
		getTagsForPost(params.id),
	]);

	let postDomain = null;
	if (post.domainId) {
		const [d] = await db
			.select({ id: domain.id, slug: domain.slug, name: domain.name })
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
