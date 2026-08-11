import { parseAnalyticsRange } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import { getWebVitals } from '$lib/server/db/analytics/aggregations';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	requireAdmin(locals);

	const { range, days } = parseAnalyticsRange(url);

	return {
		title: 'Web Vitals',
		range,
		vitals: safeDeferPromise(getWebVitals(days), []),
	};
};
