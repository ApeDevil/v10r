/**
 * Admin telemetry reads over the Image Metadata Reader's `image.ai_proposal` table.
 *
 * Lives beside the chatbot's `admin-queries.ts` because, by the established precedent,
 * every admin AI telemetry query lives in `db/ai/` — co-located by the admin consumer,
 * not by the source schema (the same way `getTopUsersByConversations` joins `auth.user`
 * yet lives here). These are read-only aggregates, called only from `requireAdmin` loaders.
 *
 * Two correctness rules baked in:
 *  - Displayed token total is input+output ONLY. `reasoning_tokens` is a SUBSET of output
 *    (empirically confirmed) — summing it double-counts. It's exposed as its own figure.
 *  - Per-image questions COUNT(DISTINCT image_id); `ai_proposal` is append-only (re-runs
 *    add rows), so counting rows would inflate by the re-run multiplier.
 */

import { count, desc, eq, gte, sql } from 'drizzle-orm';
import type { ImageConversionFunnel, ImageUsageKpis, UsageVolumeDay } from '$lib/schemas/admin/model-usage';
import { db } from '../index';
import { imageAiProposal, imageMetadata } from '../schema/showcase/image-metadata';

/** Window cutoff: local midnight `days` ago (matches getMessageVolumeByDay). */
function since(days: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - days);
	d.setHours(0, 0, 0, 0);
	return d;
}

export interface ImageModelUsageRow {
	modelId: string;
	providerId: string;
	inputTokens: number | null;
	outputTokens: number | null;
	reasoningTokens: number | null;
	analyses: number;
}

/**
 * Per-model image-analysis usage. Token columns are nullable (a provider may omit usage),
 * so the SUMs are NOT coalesced to 0 — an all-NULL group stays NULL and propagates to
 * estimateCost's null-guard → "not reported", never a false $0. `analyses` (a COUNT) is
 * always a real integer. `model_id`/`provider_id` are NOT NULL in this table, so no
 * 'unknown' bucket arises (unlike the chat surface). Uses image_ai_proposal_created_model_idx.
 */
export async function getImageModelUsage(days = 30): Promise<ImageModelUsageRow[]> {
	const rows = await db
		.select({
			modelId: imageAiProposal.modelId,
			providerId: imageAiProposal.providerId,
			inputTokens: sql<number | null>`SUM(${imageAiProposal.inputTokens})`,
			outputTokens: sql<number | null>`SUM(${imageAiProposal.outputTokens})`,
			reasoningTokens: sql<number | null>`SUM(${imageAiProposal.reasoningTokens})`,
			analyses: count(),
		})
		.from(imageAiProposal)
		.where(gte(imageAiProposal.createdAt, since(days)))
		.groupBy(imageAiProposal.modelId, imageAiProposal.providerId)
		.orderBy(desc(count()));

	return rows.map((r) => ({
		modelId: r.modelId,
		providerId: r.providerId,
		// Number(null) is 0 — guard so an unreported-usage model stays null, not a false 0.
		inputTokens: r.inputTokens == null ? null : Number(r.inputTokens),
		outputTokens: r.outputTokens == null ? null : Number(r.outputTokens),
		reasoningTokens: r.reasoningTokens == null ? null : Number(r.reasoningTokens),
		analyses: Number(r.analyses),
	}));
}

/** Successful analyses per day over the window (for the SSR bar chart). */
export async function getImageVolumeByDay(days = 30): Promise<UsageVolumeDay[]> {
	const rows = await db
		.select({
			date: sql<string>`date_trunc('day', ${imageAiProposal.createdAt})::date::text`,
			count: count(),
		})
		.from(imageAiProposal)
		.where(gte(imageAiProposal.createdAt, since(days)))
		.groupBy(sql`date_trunc('day', ${imageAiProposal.createdAt})`)
		.orderBy(sql`date_trunc('day', ${imageAiProposal.createdAt})`);

	return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

/**
 * Conversion funnel: did an analysis end in a saved metadata record? `image.metadata` is
 * born ONLY at save (saveImageMetadata), so an analyzed-but-abandoned image has NO metadata
 * row → a LEFT JOIN is mandatory; an INNER JOIN would silently drop every abandonment, the
 * very signal this measures. COUNT(DISTINCT image_id) because ai_proposal is append-only.
 */
export async function getImageConversionFunnel(days = 30): Promise<ImageConversionFunnel> {
	const rows = await db
		.select({
			saved: sql<number>`COUNT(DISTINCT ${imageAiProposal.imageId}) FILTER (WHERE ${imageMetadata.id} IS NOT NULL)`,
			abandoned: sql<number>`COUNT(DISTINCT ${imageAiProposal.imageId}) FILTER (WHERE ${imageMetadata.id} IS NULL)`,
		})
		.from(imageAiProposal)
		.leftJoin(imageMetadata, eq(imageMetadata.imageId, imageAiProposal.imageId))
		.where(gte(imageAiProposal.createdAt, since(days)));

	const saved = Number(rows[0]?.saved ?? 0);
	const abandoned = Number(rows[0]?.abandoned ?? 0);
	const totalImages = saved + abandoned;
	return { totalImages, saved, abandoned, savedRate: totalImages > 0 ? saved / totalImages : null };
}

/** Headline tiles: successful-analysis volume + last activity. */
export async function getImageUsageKpis(days = 30): Promise<ImageUsageKpis> {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const [windowed, today, distinct, last] = await Promise.all([
		db
			.select({ c: count() })
			.from(imageAiProposal)
			.where(gte(imageAiProposal.createdAt, since(days))),
		db.select({ c: count() }).from(imageAiProposal).where(gte(imageAiProposal.createdAt, startOfDay)),
		db
			.select({ c: sql<number>`COUNT(DISTINCT ${imageAiProposal.imageId})` })
			.from(imageAiProposal)
			.where(gte(imageAiProposal.createdAt, since(days))),
		db.select({ last: sql<string | null>`MAX(${imageAiProposal.createdAt})::text` }).from(imageAiProposal),
	]);

	return {
		analyses: Number(windowed[0]?.c ?? 0),
		analysesToday: Number(today[0]?.c ?? 0),
		distinctImages: Number(distinct[0]?.c ?? 0),
		lastAnalysisAt: last[0]?.last ?? null,
	};
}
