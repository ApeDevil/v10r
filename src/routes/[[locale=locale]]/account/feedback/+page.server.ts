import { listOwnFeedback } from '#lib/server/feedback/index.ts';
import { requireAuth } from '#lib/server/http/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = requireAuth(locals, url.pathname + url.search);
	const offsetParam = Number(url.searchParams.get('offset') ?? '0');
	const offset = Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;
	const list = await listOwnFeedback(user.id, { offset });
	return {
		title: 'My feedback',
		...list,
		items: list.items.map((item) => ({ ...item, submittedAt: item.submittedAt.toISOString() })),
	};
};
