/**
 * Always-loaded overview page.
 *
 * The overview sits in the system prompt on every chat turn, giving the
 * model a "map" of the knowledge base. Keep it small — OVERVIEW_MAX_TOKENS
 * is the budget. If no overview exists, return null and the caller skips
 * injection gracefully.
 */

import { OVERVIEW_MAX_TOKENS } from './config';
import { getOverview as getOverviewRow } from './queries';
import type { LlmwikiPage } from './types';

const CHARS_PER_TOKEN = 4;

/** Load the overview page for a user/collection, truncated to budget. */
export async function loadOverview(
	userId: string,
	collectionId: string | null,
): Promise<LlmwikiPage | null> {
	const page = await getOverviewRow(userId, collectionId);
	if (!page) return null;

	const maxChars = OVERVIEW_MAX_TOKENS * CHARS_PER_TOKEN;
	if (page.body.length > maxChars) {
		return { ...page, body: `${page.body.slice(0, maxChars)}…` };
	}
	return page;
}
