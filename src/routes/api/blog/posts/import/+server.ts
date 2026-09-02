import { parse as parseYaml } from 'yaml';
import { createPost, createRevision, getPostBySlug } from '$lib/server/blog';
import { WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_PREFIX, WRITE_RATE_LIMIT_WINDOW } from '$lib/server/blog/config';
import { payloadTooLargeResponse, readTextBounded } from '$lib/server/http/body';
import { guardApiBlogAuthor, guardPostOwnership } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError, apiOk } from '$lib/server/http/response';
import { SLUG_PATTERN } from '$lib/server/schemas';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(WRITE_RATE_LIMIT_PREFIX, WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_WINDOW);

/**
 * A markdown post with frontmatter. Generous for prose, and far below the point
 * where the two `[\s\S]*?` frontmatter scans below become interesting — an
 * unbounded body reaching a backtracking regex is the amplifier here, not the
 * storage.
 */
const MAX_IMPORT_BYTES = 512 * 1024;

/** Import a .md file with YAML frontmatter to create/update a post. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await readTextBounded(request, MAX_IMPORT_BYTES);
	if (!body.ok) return payloadTooLargeResponse(MAX_IMPORT_BYTES);
	const text = body.value;
	if (!text.trim()) return apiError(400, 'empty_file', 'Empty file');

	const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!fmMatch)
		return apiError(400, 'invalid_frontmatter', 'Invalid markdown file: missing YAML frontmatter (---...---)');

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

	if (!SLUG_PATTERN.test(slug)) {
		return apiError(400, 'invalid_slug', 'Invalid slug format');
	}

	// Check if post with this slug already exists
	const existingPost = await getPostBySlug(slug);

	if (existingPost) {
		// Ownership only — `existingPost` is already narrowed by the `if`, so the
		// returned value is discarded rather than re-bound.
		const owned = guardPostOwnership(existingPost, user);
		if ('error' in owned) return owned.error;
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
