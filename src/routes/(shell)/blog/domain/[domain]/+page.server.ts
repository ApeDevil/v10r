import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listPosts, getDomainBySlug } from '$lib/server/blog';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ params, url }) => {
	const domainRow = await getDomainBySlug(params.domain);

	if (!domainRow) {
		error(404, 'Domain not found');
	}

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const { items, total } = await listPosts({
		status: 'published',
		domainSlug: params.domain,
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
		domainName: domainRow.name,
		domainSlug: domainRow.slug,
	};
};
