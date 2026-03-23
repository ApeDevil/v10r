import type { PageServerLoad } from './$types';
import { listPosts } from '$lib/server/blog';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const { items, total } = await listPosts({
		status: 'published',
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
	};
};
