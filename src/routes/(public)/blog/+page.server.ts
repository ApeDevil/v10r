import { tc } from '$lib/i18n/content';
import { listPosts } from '$lib/server/blog';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 12;

export const load: PageServerLoad = async ({ url, locals }) => {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const locale = locals.locale;

	const { items, total } = await listPosts({
		status: 'published',
		page,
		pageSize: PAGE_SIZE,
		sort: 'published',
		dir: 'desc',
	});

	// Resolve translatable tag/domain names per active locale.
	// Track whether any field fell back to EN (for the LocaleFallbackBanner).
	let localeFallback = false;
	const posts = items.map((p) => ({
		...p,
		tags: p.tags.map((t) => {
			if (locale !== 'en' && !t.nameI18n?.[locale]) localeFallback = true;
			return { ...t, name: tc(t.name, t.nameI18n, locale) };
		}),
	}));

	return {
		title: 'Blog',
		posts,
		total,
		page,
		totalPages: Math.ceil(total / PAGE_SIZE),
		localeFallback,
	};
};
