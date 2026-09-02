import { stringify } from 'yaml';
import { getLatestRevision, getPostById, getTagsForPost } from '$lib/server/blog';
import { guardApiBlogAuthor, guardPostOwnership } from '$lib/server/http/guards';
import type { RequestHandler } from './$types';

/** Export a post as a .md file with YAML frontmatter. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	// Ownership, not just authorship rights: the blog-author grant says you may
	// write posts, not that you may read out anyone else's. Every sibling post
	// route checks this; export did not, so it exported any post by id.
	const owned = guardPostOwnership(await getPostById(params.id), user);
	if ('error' in owned) return owned.error;
	const { post } = owned;

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
