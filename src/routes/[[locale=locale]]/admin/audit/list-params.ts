import { urlParam } from '#lib/state/url-state.ts';

/**
 * `/admin/audit` filter state — the load parses it and the page links with it, from this one
 * spec. The CSV export endpoint reads the same names but rejects a malformed date with a 400,
 * which is an API contract rather than a fallback.
 */
export const auditListParams = {
	action: urlParam.text(),
	actor: urlParam.text(),
	target_type: urlParam.text(),
	from: urlParam.text(),
	to: urlParam.text(),
	page: urlParam.integer({ fallback: 1, min: 1 }),
};
