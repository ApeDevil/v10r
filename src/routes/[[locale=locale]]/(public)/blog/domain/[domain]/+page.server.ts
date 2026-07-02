import { error } from '@sveltejs/kit';
import { getDomainBySlug, listPosts } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ params, url }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// The domain lookup (for the 404 + display name) and the post list both key off
	// params.domain independently — fetch them in parallel.
	const [domainRow, { items, total }] = await Promise.all([
		getDomainBySlug(params.domain),
		listPosts({
			status: 'published',
			domainSlug: params.domain,
			page,
			pageSize: PAGE_SIZE,
			sort: 'published',
			dir: 'desc',
		}),
	]);

	if (!domainRow) {
		error(404, 'Domain not found');
	}

	return {
		title: `${domainRow.name} - Blog`,
		posts: items,
		total,
		page,
		totalPages: Math.ceil(total / PAGE_SIZE),
		domainName: domainRow.name,
		domainSlug: domainRow.slug,
	};
};
