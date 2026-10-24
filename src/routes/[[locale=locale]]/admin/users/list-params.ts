import { urlParam } from '#lib/state/url-state.ts';

/** `/admin/users` list state — the load parses it and the page links with it, from this one spec. */
export const usersListParams = {
	q: urlParam.text(),
	page: urlParam.integer({ fallback: 1, min: 1 }),
	sort: urlParam.oneOf(['email', 'name', 'createdAt'], 'createdAt'),
	dir: urlParam.oneOf(['asc', 'desc'], 'desc'),
	status: urlParam.oneOf(['all', 'active', 'banned'], 'all'),
};
