import { requireAdmin } from '$lib/server/auth/guards';
import { getAIOverviewStats } from '$lib/server/db/ai/admin-queries';
import { getRAGOverviewStats } from '$lib/server/db/rag/admin-queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	// Provider snapshot (`providers`, `activeProvider`) is inherited from the
	// section layout — render the headline AI + corpus counts here.
	const [ai, rag] = await Promise.all([getAIOverviewStats(), getRAGOverviewStats()]);

	return { title: 'AI Overview', ai, rag };
};
