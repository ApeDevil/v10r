/**
 * Admin inventory queries over the `llmwiki_*` tables (the rag pgSchema owns them).
 * Pure COUNT / GROUP BY aggregations — zero new columns. These feed the nRAG
 * admin tab's Wiki-Health panel and the pipeline diagram's llmwiki node badge.
 *
 * NOTE: `compile/` and `lint/` are still scaffold (COMPILE_SCAFFOLD / LINT_SCAFFOLD),
 * so on a fresh install these counts are legitimately zero — the UI distinguishes
 * "no issues" from "lint runner not yet wired" using the *Scaffold flags returned here.
 */

import { count, isNull, sql } from 'drizzle-orm';
import { COMPILE_SCAFFOLD } from '$lib/server/llmwiki/compile';
import { LINT_SCAFFOLD } from '$lib/server/llmwiki/lint';
import { db } from '../index';
import { llmwikiLintIssue, llmwikiPage, llmwikiPageLink, llmwikiPageRedirect } from '../schema/rag';

export interface LlmwikiAdminStats {
	totalPages: number;
	overviewPages: number;
	contentPages: number;
	stalePages: number;
	totalLinks: number;
	brokenLinks: number;
	totalRedirects: number;
	openLintIssues: number;
	lintByCode: Record<string, number>;
	lintBySeverity: Record<string, number>;
	compiledByModel: Record<string, number>;
	/** True while the compile pipeline is a stub — page counts may legitimately be 0. */
	compileScaffold: boolean;
	/** True while the lint runner is a stub — issue counts are not yet meaningful. */
	lintScaffold: boolean;
}

export async function getLlmwikiAdminStats(): Promise<LlmwikiAdminStats> {
	const [pageStats, byModel, linkStats, redirectCount, lintOpen, lintByCodeRows, lintBySeverityRows] =
		await Promise.all([
			db
				.select({
					total: count(),
					overview: sql<number>`count(*) FILTER (WHERE ${llmwikiPage.kind} = 'overview')`,
					page: sql<number>`count(*) FILTER (WHERE ${llmwikiPage.kind} = 'page')`,
					stale: sql<number>`count(*) FILTER (WHERE ${llmwikiPage.stale} = true)`,
				})
				.from(llmwikiPage)
				.where(isNull(llmwikiPage.deletedAt)),
			db
				.select({ model: llmwikiPage.compiledByModel, n: count() })
				.from(llmwikiPage)
				.where(isNull(llmwikiPage.deletedAt))
				.groupBy(llmwikiPage.compiledByModel),
			db
				.select({
					total: count(),
					broken: sql<number>`count(*) FILTER (WHERE ${llmwikiPageLink.toId} IS NULL)`,
				})
				.from(llmwikiPageLink),
			db.select({ total: count() }).from(llmwikiPageRedirect),
			db.select({ total: count() }).from(llmwikiLintIssue).where(isNull(llmwikiLintIssue.resolvedAt)),
			db
				.select({ code: llmwikiLintIssue.code, n: count() })
				.from(llmwikiLintIssue)
				.where(isNull(llmwikiLintIssue.resolvedAt))
				.groupBy(llmwikiLintIssue.code),
			db
				.select({ severity: llmwikiLintIssue.severity, n: count() })
				.from(llmwikiLintIssue)
				.where(isNull(llmwikiLintIssue.resolvedAt))
				.groupBy(llmwikiLintIssue.severity),
		]);

	const ps = pageStats[0];

	const lintByCode: Record<string, number> = {};
	for (const r of lintByCodeRows) lintByCode[r.code] = Number(r.n);

	const lintBySeverity: Record<string, number> = {};
	for (const r of lintBySeverityRows) lintBySeverity[r.severity] = Number(r.n);

	const compiledByModel: Record<string, number> = {};
	for (const r of byModel) compiledByModel[r.model] = Number(r.n);

	return {
		totalPages: ps?.total ?? 0,
		overviewPages: Number(ps?.overview ?? 0),
		contentPages: Number(ps?.page ?? 0),
		stalePages: Number(ps?.stale ?? 0),
		totalLinks: linkStats[0]?.total ?? 0,
		brokenLinks: Number(linkStats[0]?.broken ?? 0),
		totalRedirects: redirectCount[0]?.total ?? 0,
		openLintIssues: lintOpen[0]?.total ?? 0,
		lintByCode,
		lintBySeverity,
		compiledByModel,
		compileScaffold: COMPILE_SCAFFOLD,
		lintScaffold: LINT_SCAFFOLD,
	};
}
