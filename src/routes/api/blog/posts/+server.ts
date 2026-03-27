import { json, error } from '@sveltejs/kit';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listPosts, createPost, isSlugTaken } from '$lib/server/blog';
import type { RequestHandler } from './$types';

/** List posts for current author (all statuses). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiAuthor(locals);

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const status = url.searchParams.get('status') as 'draft' | 'published' | 'archived' | undefined;
	const validStatuses = ['draft', 'published', 'archived'];

	const result = await listPosts({
		authorId: user.id,
		status: status && validStatuses.includes(status) ? status : undefined,
		page,
		pageSize: 50,
		sort: 'updated',
		dir: 'desc',
	});

	return json(result);
};

/** Create a new draft post. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);
	const body = await request.json();
	const slug = (body.slug as string)?.trim();

	if (!slug) error(400, 'Slug is required');
	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
		error(400, 'Slug must be lowercase alphanumeric with hyphens');
	}

	const taken = await isSlugTaken(slug);
	if (taken) error(400, 'Slug already taken');

	const post = await createPost(user.id, { slug });
	return json({ post }, { status: 201 });
};
