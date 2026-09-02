/**
 * Admin inventory over `llmwiki_page` (the rag pgSchema owns it).
 * Pure COUNT / GROUP BY aggregations — zero new columns. Feeds the retrieval
 * admin tab's Wiki-Health panel and the pipeline diagram's llmwiki node badge.
 */

import { count, isNull, sql } from 'drizzle-orm';
import { db } from '../index';
import { llmwikiPage } from '../schema/retrieval';

export interface LlmwikiAdminStats {
	totalPages: number;
	overviewPages: number;
	contentPages: number;
	stalePages: number;
}

export async function getLlmwikiAdminStats(): Promise<LlmwikiAdminStats> {
	const pageStats = await db
		.select({
			total: count(),
			overview: sql<number>`count(*) FILTER (WHERE ${llmwikiPage.kind} = 'overview')`,
			page: sql<number>`count(*) FILTER (WHERE ${llmwikiPage.kind} = 'page')`,
			stale: sql<number>`count(*) FILTER (WHERE ${llmwikiPage.stale} = true)`,
		})
		.from(llmwikiPage)
		.where(isNull(llmwikiPage.deletedAt));

	const ps = pageStats[0];

	return {
		totalPages: ps?.total ?? 0,
		overviewPages: Number(ps?.overview ?? 0),
		contentPages: Number(ps?.page ?? 0),
		stalePages: Number(ps?.stale ?? 0),
	};
}
