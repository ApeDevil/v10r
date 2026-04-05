import { error } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { getPostById, getLatestRevision, getTagsForPost } from '$lib/server/blog';
import { stringify } from 'yaml';
import type { RequestHandler } from './$types';

/** Export a post as a .md file with YAML frontmatter. */
export const GET: RequestHandler = async ({ params, locals }) => {
	requireApiAuthor(locals);

	const post = await getPostById(params.id);
	if (!post) error(404, 'Post not found');

	const revision = await getLatestRevision(params.id);
	const tags = await getTagsForPost(params.id);

	const frontmatter: Record<string, unknown> = {
		title: revision?.title ?? '',
		slug: post.slug,
		status: post.status,
	};

	if (revision?.summary) frontmatter.summary = revision.summary;
	if (revision?.locale && revision.locale !== 'en') frontmatter.locale = revision.locale;
	if (tags.length > 0) frontmatter.tags = tags.map((t) => t.name);

	const yaml = stringify(frontmatter).trim();
	const markdown = revision?.markdown ?? '';
	const content = `---\n${yaml}\n---\n\n${markdown}`;

	return new Response(content, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(post.slug)}.md`,
		},
	});
};
