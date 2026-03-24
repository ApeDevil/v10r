import { json, error } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { createPost, createRevision, getPostBySlug } from '$lib/server/blog';
import { parse as parseYaml } from 'yaml';
import type { RequestHandler } from './$types';

/** Import a .md file with YAML frontmatter to create/update a post. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const text = await request.text();
	if (!text.trim()) error(400, 'Empty file');

	// Parse frontmatter
	const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!fmMatch) error(400, 'Invalid markdown file: missing YAML frontmatter (---...---)');

	let frontmatter: Record<string, unknown>;
	try {
		frontmatter = parseYaml(fmMatch[1]) as Record<string, unknown>;
	} catch {
		error(400, 'Invalid YAML frontmatter');
	}

	const markdown = (fmMatch[2] ?? '').trim();
	const title = (frontmatter.title as string) ?? 'Untitled';
	const summary = (frontmatter.summary as string) ?? '';
	const locale = (frontmatter.locale as string) ?? 'en';
	let slug = (frontmatter.slug as string)?.trim();

	if (!slug) {
		// Derive slug from title
		slug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
		error(400, 'Invalid slug format');
	}

	// Check if post with this slug already exists
	const existingPost = await getPostBySlug(slug);

	if (existingPost) {
		// Create new revision on existing post
		const revision = await createRevision(existingPost.id, {
			title,
			summary,
			markdown,
			locale,
			authorId: user.id,
		});
		return json({ post: existingPost, revision, created: false });
	}

	// Create new post + first revision
	const post = await createPost(user.id, { slug });
	const revision = await createRevision(post.id, {
		title,
		summary,
		markdown,
		locale,
		authorId: user.id,
	});

	return json({ post, revision, created: true }, { status: 201 });
};
