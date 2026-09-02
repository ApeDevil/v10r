import { getAiOverviewStats } from '$lib/server/db/ai/admin-queries';
import { getImageUsageKpis } from '$lib/server/db/ai/image-metadata-queries';
import { getRetrievalOverviewStats } from '$lib/server/db/retrieval/admin-queries';
import { requireAdmin } from '$lib/server/http/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	// Provider snapshot (`providers`, `activeProvider`) is inherited from the
	// section layout — render the headline AI + corpus + image-feature counts here.
	// Image card is a HEARTBEAT only (no cost) — dollar figures live on the Cost tab,
	// where they carry the reference-pricing caveat. A $ next to chat counts would read
	// as "total AI spend" when it isn't.
	const [ai, retrieval, images] = await Promise.all([
		getAiOverviewStats(),
		getRetrievalOverviewStats(),
		getImageUsageKpis(30),
	]);

	return { title: 'AI Overview', ai, retrieval, images };
};
