import { error } from '@sveltejs/kit';
import { getTagBySlug, listPosts } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ params, url }) => {
	const tagRow = await getTagBySlug(params.tag);

	if (!tagRow) {
		error(404, 'Tag not found');
	}

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const { items, total } = await listPosts({
		status: 'published',
		tagSlug: params.tag,
		page,
		pageSize: PAGE_SIZE,
		sort: 'published',
		dir: 'desc',
	});

	return {
		posts: items,
		total,
		page,
		totalPages: Math.ceil(total / PAGE_SIZE),
		tagName: tagRow.name,
		tagSlug: tagRow.slug,
	};
};
