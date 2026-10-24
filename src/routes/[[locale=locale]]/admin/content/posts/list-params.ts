import { urlParam } from '#lib/state/url-state.ts';

/** `/admin/content/posts` list state — the load parses it and the page links with it, from this one spec. */
export const postsListParams = {
	q: urlParam.text(),
	page: urlParam.integer({ fallback: 1, min: 1 }),
	sort: urlParam.oneOf(['title', 'status', 'created', 'updated', 'published'], 'created'),
	dir: urlParam.oneOf(['asc', 'desc'], 'desc'),
	status: urlParam.oneOf(['all', 'draft', 'published', 'archived'], 'all'),
};
