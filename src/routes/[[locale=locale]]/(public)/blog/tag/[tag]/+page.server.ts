import { error } from '@sveltejs/kit';
import { getTagBySlug, listPosts } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ params, url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// The tag lookup (for the 404 + display name) and the post list both key off
	// params.tag independently — fetch them in parallel.
	const [tagRow, { items, total }] = await Promise.all([
		getTagBySlug(params.tag),
		listPosts({
			status: 'published',
			tagSlug: params.tag,
			page,
			pageSize: PAGE_SIZE,
			sort: 'published',
			dir: 'desc',
		}),
	]);

	if (!tagRow) {
		error(404, 'Tag not found');
	}

	return {
		title: `Posts tagged "${tagRow.name}"`,
		posts: items,
		total,
		page,
		totalPages: Math.ceil(total / PAGE_SIZE),
		tagName: tagRow.name,
		tagSlug: tagRow.slug,
	};
};
