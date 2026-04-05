import { requireApiAuthor, requirePostOwnership } from '$lib/server/auth/guards';
import { createPost, createRevision, getPostBySlug } from '$lib/server/blog';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk, apiCreated, apiError } from '$lib/server/api/response';
import { BLOG_WRITE_RATE_LIMIT_PREFIX, BLOG_WRITE_RATE_LIMIT_MAX, BLOG_WRITE_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { parse as parseYaml } from 'yaml';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(BLOG_WRITE_RATE_LIMIT_PREFIX, BLOG_WRITE_RATE_LIMIT_MAX, BLOG_WRITE_RATE_LIMIT_WINDOW);

/** Import a .md file with YAML frontmatter to create/update a post. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const text = await request.text();
	if (!text.trim()) return apiError(400, 'empty_file', 'Empty file');

	// Parse frontmatter
	const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!fmMatch) return apiError(400, 'invalid_frontmatter', 'Invalid markdown file: missing YAML frontmatter (---...---)');

	let frontmatter: Record<string, unknown>;
	try {
		frontmatter = parseYaml(fmMatch[1]) as Record<string, unknown>;
	} catch {
		return apiError(400, 'invalid_yaml', 'Invalid YAML frontmatter');
	}

	const markdown = (fmMatch[2] ?? '').trim();
	const title = (frontmatter.title as string) ?? 'Untitled';
	const summary = (frontmatter.summary as string) ?? '';
	const locale = (frontmatter.locale as string) ?? 'en';
	let slug = (frontmatter.slug as string)?.trim();

	if (!slug) {
		slug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
		return apiError(400, 'invalid_slug', 'Invalid slug format');
	}

	// Check if post with this slug already exists
	const existingPost = await getPostBySlug(slug);

	if (existingPost) {
		requirePostOwnership(existingPost, user);
		// Create new revision on existing post
		const revision = await createRevision(existingPost.id, {
			title,
			summary,
			markdown,
			locale,
			authorId: user.id,
		});
		return apiOk({ post: existingPost, revision, created: false });
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

	return apiCreated({ post, revision, created: true });
};
