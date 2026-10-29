import { describe, expect, it } from 'vitest';
import { normalizeRouteId, resolveRouteLabel, siteAwareRouteKey } from './route-id';

const WORKFLOW_ROUTE = '/[[locale=locale]]/(public)/workflows/[slug]';

describe('siteAwareRouteKey', () => {
	it('fills in a catalogued workflow slug, so the tutorial page resolves', () => {
		const key = siteAwareRouteKey(WORKFLOW_ROUTE, 'excel-with-ai');
		expect(key).toBe('/[[locale=locale]]/(public)/workflows/excel-with-ai');
		expect(normalizeRouteId(key)).toBe('/workflows/excel-with-ai');
		expect(resolveRouteLabel(key)).not.toBeNull();
	});

	it('keeps an unknown slug out, so the route stays unresolvable', () => {
		const key = siteAwareRouteKey(WORKFLOW_ROUTE, 'not-a-workflow');
		expect(key).toBe(WORKFLOW_ROUTE);
		expect(normalizeRouteId(key)).toBeNull();
	});

	it('never fills in the slug of another dynamic route', () => {
		const blog = '/[[locale=locale]]/(public)/blog/[slug]';
		expect(siteAwareRouteKey(blog, 'excel-with-ai')).toBe(blog);
		expect(normalizeRouteId(siteAwareRouteKey(blog, 'excel-with-ai'))).toBeNull();
	});

	it('passes static routes and a missing route through', () => {
		expect(siteAwareRouteKey('/[[locale=locale]]/(public)/workflows', undefined)).toBe(
			'/[[locale=locale]]/(public)/workflows',
		);
		expect(siteAwareRouteKey(null, 'excel-with-ai')).toBeNull();
	});
});
